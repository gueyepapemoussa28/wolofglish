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
const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Le quota gratuit de Gemini est vite atteint, et les modèles changent de nom
// au fil des mois. On découvre donc les modèles réellement disponibles pour la
// clé, en plaçant les plus légers d'abord : ce sont eux qui ont les quotas
// gratuits les plus généreux.
let modelesEnCache = null;

async function listerModelesGemini() {
  if (modelesEnCache) {
    return modelesEnCache;
  }

  const candidats = [];
  if (process.env.GEMINI_MODEL) {
    candidats.push(process.env.GEMINI_MODEL);
  }

  try {
    const reponse = await fetch(`${GEMINI_BASE}/models?key=${process.env.GEMINI_API_KEY}`);
    if (reponse.ok) {
      const donnees = await reponse.json();
      const rang = (nom) => {
        if (nom.includes("flash-lite")) return 0;
        if (nom.includes("flash")) return 1;
        return 2;
      };
      (donnees.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => String(m.name).replace(/^models\//, ""))
        .sort((a, b) => rang(a) - rang(b))
        .forEach((nom) => candidats.push(nom));
    }
  } catch (err) {
    // Liste inaccessible : on se rabat sur les noms connus.
  }

  candidats.push("gemini-3.6-flash");
  modelesEnCache = [...new Set(candidats.filter(Boolean))].slice(0, 4);
  return modelesEnCache;
}

async function genererLecon(transcriptionWolof) {
  const modeles = await listerModelesGemini();
  let dernierDetail = "";
  let quotaAtteint = false;

  for (const modele of modeles) {
    const reponse = await fetch(
      `${GEMINI_BASE}/models/${modele}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${SYSTEM_PROMPT}\n\nPhrase wolof : "${transcriptionWolof}"` }],
            },
          ],
        }),
      }
    );

    if (reponse.ok) {
      const donnees = await reponse.json();
      const texte = donnees.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (texte) {
        // On retient le modèle qui a répondu pour les appels suivants.
        modelesEnCache = [modele, ...modeles.filter((m) => m !== modele)];
        return { ok: true, texte };
      }
      dernierDetail = "Réponse vide du modèle " + modele + ".";
      continue;
    }

    dernierDetail = await reponse.text();

    if (reponse.status === 429) {
      quotaAtteint = true;
      continue; // un modèle plus léger a peut-être encore du quota
    }
    if (reponse.status === 404) {
      continue; // modèle retiré : on essaie le suivant
    }
    break; // clé invalide, requête malformée : changer de modèle n'y fera rien
  }

  return { ok: false, quotaAtteint, details: dernierDetail };
}
// Les comptes ElevenLabs gratuits n'ont pas accès aux voix de la bibliothèque
// (dont "Rachel"). On essaie donc successivement les voix réellement
// disponibles sur le compte, et on mémorise la première qui fonctionne.
let voixEnCache = null;

async function listerVoixCandidates() {
  const candidates = [];
  if (voixEnCache) candidates.push(voixEnCache);
  if (process.env.ELEVENLABS_VOICE_ID) candidates.push(process.env.ELEVENLABS_VOICE_ID);

  try {
    const reponse = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    });

    if (reponse.ok) {
      const donnees = await reponse.json();
      // Les voix appartenant au compte passent avant celles de la bibliothèque.
      const ordre = ["cloned", "generated", "professional", "premade"];
      const rang = (categorie) => {
        const index = ordre.indexOf(categorie);
        return index === -1 ? ordre.length : index;
      };
      (donnees.voices || [])
        .slice()
        .sort((a, b) => rang(a.category) - rang(b.category))
        .forEach((voix) => candidates.push(voix.voice_id));
    }
  } catch (err) {
    // Liste inaccessible : on se contente des identifiants déjà connus.
  }

  return [...new Set(candidates.filter(Boolean))].slice(0, 6);
}

async function synthetiser(texte) {
  const voixDisponibles = await listerVoixCandidates();

  if (voixDisponibles.length === 0) {
    return { ok: false, details: "Aucune voix disponible sur ce compte ElevenLabs." };
  }

  let dernierDetail = "";

  for (const voixId of voixDisponibles) {
    const reponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voixId}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: texte, model_id: "eleven_multilingual_v2" }),
    });

    if (reponse.ok) {
      voixEnCache = voixId;
      return { ok: true, audio: await reponse.arrayBuffer() };
    }

    dernierDetail = await reponse.text();
    if (voixEnCache === voixId) {
      voixEnCache = null;
    }

    // Une voix réservée aux offres payantes : on tente la suivante.
    // Toute autre erreur (quota épuisé, clé invalide) ne se règle pas
    // en changeant de voix, inutile d'insister.
    if (dernierDetail.indexOf("paid_plan_required") === -1) {
      break;
    }
  }

  return { ok: false, details: dernierDetail };
}

const SYSTEM_PROMPT = `Tu es un professeur bienveillant qui aide un locuteur wolof à apprendre l'anglais.
On te donne une phrase transcrite en wolof. Réponds UNIQUEMENT avec :
1. La traduction en anglais de la phrase.
2. Une courte explication en wolof de la construction (1 phrase max).
Format de réponse strict : "EN: <traduction> | WO: <explication>"`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée, utilise POST." });
  }

  const { audioBase64, mimeType } = req.body || {};
  if (!audioBase64) {
    return res.status(400).json({ error: "Champ 'audioBase64' manquant dans le corps de la requête." });
  }

  const clesManquantes = ["HF_API_KEY", "GEMINI_API_KEY", "ELEVENLABS_API_KEY"].filter(
    (cle) => !process.env[cle]
  );
  if (clesManquantes.length > 0) {
    return res.status(500).json({
      error: "Configuration incomplète",
      details: "Variables d'environnement manquantes sur Vercel : " + clesManquantes.join(", "),
    });
  }

  try {
    // 1. STT : audio wolof -> texte (Hugging Face Inference API)
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const sttResponse = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": mimeType || "audio/webm",
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
    const resultatLlm = await genererLecon(transcriptionWolof);

    if (!resultatLlm.ok) {
      if (resultatLlm.quotaAtteint) {
        return res.status(429).json({
          error: "Quota Gemini atteint",
          details:
            "Le quota gratuit de l'API Google est épuisé. Les limites par minute " +
            "se libèrent au bout d'une minute ; les limites journalières repartent " +
            "à minuit, heure du Pacifique (9h heure de Dakar).",
        });
      }
      return res.status(502).json({ error: "Échec LLM (Gemini)", details: resultatLlm.details });
    }

    const reponseLLM = resultatLlm.texte;

    // On extrait la partie anglaise pour la TTS (avant le séparateur "|")
    const texteAnglais = reponseLLM.split("|")[0].replace(/^EN:\s*/i, "").trim();

    // 3. TTS : texte anglais -> audio (ElevenLabs)
    // Une panne de synthèse vocale ne doit pas faire perdre la leçon :
    // on renvoie le texte quoi qu'il arrive, et le navigateur lira
    // lui-même la phrase anglaise si l'audio manque.
    const resultatTts = await synthetiser(texteAnglais);

    return res.status(200).json({
      transcriptionWolof,
      reponseLLM,
      audioBase64: resultatTts.ok ? Buffer.from(resultatTts.audio).toString("base64") : null,
      avertissementTts: resultatTts.ok ? null : String(resultatTts.details).slice(0, 300),
    });
  } catch (err) {
    console.error("Erreur pipeline Wolofglish :", err);
    const cause = err && err.cause ? " (" + (err.cause.code || err.cause.message) + ")" : "";
    return res.status(500).json({
      error: "Erreur serveur",
      details: ((err && err.message) || "Exception inconnue") + cause,
    });
  }
};
