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

const PROMPT_AUDIO = `Tu es un professeur bienveillant qui aide un locuteur wolof à apprendre l'anglais.
Écoute l'enregistrement : la personne parle en WOLOF (langue du Sénégal).

Réponds UNIQUEMENT par un objet JSON valide, sans aucun texte autour :
{
  "wolof": "<ce que la personne a dit, transcrit en wolof>",
  "anglais": "<la traduction de cette phrase en anglais>",
  "explication": "<une phrase en wolof expliquant la construction anglaise>"
}

Si l'enregistrement est inaudible, vide ou incompréhensible, mets une chaîne vide dans "wolof".`;

// Gemini sait écouter l'audio directement. Un seul appel remplace donc la
// transcription Hugging Face puis la génération de la leçon — et surtout,
// Gemini connaît le wolof, contrairement à Whisper.
async function analyserAudioAvecGemini(audioBase64, mimeType) {
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
              parts: [
                { text: PROMPT_AUDIO },
                { inline_data: { mime_type: mimeType || "audio/wav", data: audioBase64 } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (reponse.ok) {
      const donnees = await reponse.json();
      const brut = donnees.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let analyse = null;
      try {
        analyse = JSON.parse(brut);
      } catch (err) {
        dernierDetail = "Réponse JSON illisible du modèle " + modele + ".";
        continue;
      }

      if (!analyse || !String(analyse.wolof || "").trim()) {
        return { ok: false, audioVide: true };
      }

      modelesEnCache = [modele, ...modeles.filter((m) => m !== modele)];
      return {
        ok: true,
        transcriptionWolof: String(analyse.wolof).trim(),
        anglais: String(analyse.anglais || "").trim(),
        explication: String(analyse.explication || "").trim(),
      };
    }

    dernierDetail = await reponse.text();

    if (reponse.status === 429) {
      quotaAtteint = true;
      continue;
    }
    if (reponse.status === 404 || reponse.status === 400) {
      continue; // modèle retiré, ou qui n'accepte pas l'audio
    }
    break;
  }

  return { ok: false, quotaAtteint, details: dernierDetail };
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
  if (!process.env.ELEVENLABS_API_KEY) {
    return { ok: false, details: "ELEVENLABS_API_KEY absente : lecture par le navigateur." };
  }

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

  // Seule la clé Gemini est indispensable : Hugging Face n'est plus qu'un
  // filet de secours, et le navigateur sait lire la leçon si ElevenLabs manque.
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Configuration incomplète",
      details: "Variable d'environnement manquante sur Vercel : GEMINI_API_KEY",
    });
  }

  try {
    // 1. Gemini écoute l'audio wolof et rédige la leçon en un seul appel.
    //    Whisper ne connaît pas le wolof : il transcrivait du charabia.
    let transcriptionWolof = "";
    let reponseLLM = "";

    const analyse = await analyserAudioAvecGemini(audioBase64, mimeType);

    if (analyse.ok) {
      transcriptionWolof = analyse.transcriptionWolof;
      reponseLLM = `EN: ${analyse.anglais} | WO: ${analyse.explication}`;
    } else if (analyse.audioVide) {
      return res.status(422).json({
        error: "Je n'ai pas compris",
        details: "L'enregistrement est inaudible ou vide. Réessaie en parlant plus près du micro.",
      });
    } else if (analyse.quotaAtteint) {
      return res.status(429).json({
        error: "Quota Gemini atteint",
        details:
          "Le quota gratuit de l'API Google est épuisé. Les limites par minute " +
          "se libèrent au bout d'une minute ; les limites journalières repartent " +
          "à minuit, heure du Pacifique (9h heure de Dakar).",
      });
    } else {
      // 2. Repli : ancien circuit Hugging Face puis Gemini sur le texte.
      if (!process.env.HF_API_KEY) {
        return res.status(502).json({
          error: "Échec de la transcription",
          details: String(analyse.details).slice(0, 300),
        });
      }

      const sttResponse = await fetch(HF_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": mimeType || "audio/wav",
        },
        body: Buffer.from(audioBase64, "base64"),
      });

      if (!sttResponse.ok) {
        return res.status(502).json({
          error: "Échec de la transcription",
          details: "Gemini : " + String(analyse.details).slice(0, 200) +
            " | Hugging Face : " + (await sttResponse.text()).slice(0, 200),
        });
      }

      const sttData = await sttResponse.json();
      transcriptionWolof = sttData.text || "";

      if (!transcriptionWolof) {
        return res.status(422).json({
          error: "Je n'ai pas compris",
          details: "Aucune parole détectée. Réessaie en parlant plus près du micro.",
        });
      }

      const resultatLlm = await genererLecon(transcriptionWolof);
      if (!resultatLlm.ok) {
        return res.status(502).json({
          error: "Échec LLM (Gemini)",
          details: String(resultatLlm.details).slice(0, 300),
        });
      }
      reponseLLM = resultatLlm.texte;
    }

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
