// api/translate.js
// Pipeline : Audio Wolof -> STT (Hugging Face) -> LLM (Gemini) -> TTS (ElevenLabs) -> Audio Anglais
//
// Requête attendue (POST) :
//   Content-Type: application/json
//   { "audioBase64": "<audio encodé en base64, format wav/m4a>" }
//
// Réponse :
//   { "transcriptionWolof": "...", "reponseLLM": "...", "audioBase64": "<audio anglais encodé>" }

const HF_MODEL = "openai/whisper-large-v3";
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // voix par défaut "Rachel"
const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

const SYSTEM_PROMPT = `Tu es un professeur bienveillant qui aide un locuteur wolof à apprendre l'anglais.
On te donne une phrase transcrite en wolof. Réponds UNIQUEMENT avec :
1. La traduction en anglais de la phrase.
2. Une courte explication en wolof de la construction (1 phrase max).
Format de réponse strict : "EN: <traduction> | WO: <explication>"`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée, utilise POST." });
  }

  const { audioBase64 } = req.body || {};
  if (!audioBase64) {
    return res.status(400).json({ error: "Champ 'audioBase64' manquant dans le corps de la requête." });
  }

  try {
    // 1. STT : audio wolof -> texte (Hugging Face Inference API)
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const sttResponse = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "audio/wav",
      },
      body: audioBuffer,
    });

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      return res.status(502).json({ error: "Échec STT (Hugging Face)", details: errText });
    }

    const sttData = await sttResponse.json();
    const transcriptionWolof = sttData.text || "";

    if (!transcriptionWolof) {
      return res.status(502).json({ error: "Transcription vide, réessaie avec un audio plus clair." });
    }

    // 2. LLM : texte wolof -> traduction + explication (Gemini)
    const llmResponse = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nPhrase wolof : "${transcriptionWolof}"` }],
          },
        ],
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      return res.status(502).json({ error: "Échec LLM (Gemini)", details: errText });
    }

    const llmData = await llmResponse.json();
    const reponseLLM = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!reponseLLM) {
      return res.status(502).json({ error: "Réponse LLM vide." });
    }

    // On extrait la partie anglaise pour la TTS (avant le séparateur "|")
    const texteAnglais = reponseLLM.split("|")[0].replace(/^EN:\s*/i, "").trim();

    // 3. TTS : texte anglais -> audio (ElevenLabs)
    const ttsResponse = await fetch(ELEVENLABS_URL, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: texteAnglais,
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      return res.status(502).json({ error: "Échec TTS (ElevenLabs)", details: errText });
    }

    const ttsArrayBuffer = await ttsResponse.arrayBuffer();
    const audioAnglaisBase64 = Buffer.from(ttsArrayBuffer).toString("base64");

    return res.status(200).json({
      transcriptionWolof,
      reponseLLM,
      audioBase64: audioAnglaisBase64,
    });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
};
