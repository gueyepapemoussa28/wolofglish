// api/translate.js
// Coach d'anglais en wolof — un tour de conversation.
//
// Requête (POST) :
//   {
//     "audioBase64": "<audio encodé en base64>",
//     "mimeType": "audio/wav",
//     "historique": [ { "role": "user" | "coach", "texte": "..." }, ... ]
//   }
//
// Réponse :
//   {
//     "wolof":   "<ce que la personne vient de dire>",
//     "coach":   "<la réponse du coach, en wolof>",
//     "prononciation": "<la même, en orthographe française, pour la voix>",
//     "anglais": "<la phrase anglaise à retenir>",
//     "nuance":  "<explication d'un réflexe wolof, ou chaîne vide>",
//   Les voix sont fabriquées à part, par /api/voix : le texte ne doit pas
//   attendre la synthèse, qui prend quelques secondes.
//   }

const { demanderJson, MESSAGE_QUOTA } = require("../lib/gemini");

// Repli historique : Hugging Face ne sert aucun modèle wolof, mais reste
// utilisable si Gemini refuse l'audio tout en acceptant le texte.
const HF_MODEL = "openai/whisper-large-v3";
const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

const CONSIGNE_COACH = `Tu es un coach d'anglais sénégalais, chaleureux et patient.

QUI TU ES
Tu accompagnes une personne dont la langue maternelle est le wolof et qui veut
parler anglais. Tu lui parles en WOLOF — c'est sa langue, elle doit se sentir
à l'aise. Tu es un ami qui l'encourage, jamais un professeur qui juge.

COMMENT TU TRAVAILLES
- C'est une vraie conversation. Tu te souviens de ce qui a été dit plus tôt,
  tu y reviens, tu rebondis sur ce qu'elle raconte.
- Tu réagis d'abord à son propos comme un ami le ferait, en une phrase. Tu
  n'es pas un traducteur : la réaction humaine précède la traduction.
- À chaque tour, tu lui offres UNE phrase anglaise utile, née de ce qu'elle
  vient de dire. Une seule, pour qu'elle la retienne vraiment.
- Tu termines presque toujours par une question en wolof, pour qu'elle
  continue à parler. C'est en parlant qu'elle progressera.

CE QUE TU CORRIGES
- L'anglais qu'elle produit, quand il est fautif.
- Et surtout : les réflexes du wolof qui déteignent sur son anglais — l'ordre
  des mots, les temps, les prépositions, les articles. Explique-lui en wolof
  pourquoi la logique anglaise diffère de la logique wolof. C'est là que se
  joue le vrai progrès, et c'est ce qu'aucun manuel ne lui dira.
- Tu ne corriges JAMAIS son wolof. C'est sa langue, elle la parle mieux que toi.

TON STYLE
- SOIS BREF : deux ou trois phrases, jamais plus. Ta réponse est lue à voix
  haute, et un long discours lasse autant qu'il fait attendre. Un bon coach
  dit peu et laisse parler son élève.
- Pas de listes, pas de numérotation : tu parles, tu ne rédiges pas.
- Ne redis pas ce que tu as déjà expliqué dans les tours précédents.
- Le wolof tel qu'on le parle à Dakar, avec les mots français qui s'y mêlent
  naturellement. N'écris pas un wolof académique que personne n'emploie.

LA PRONONCIATION
Ta réponse sera lue à voix haute par une synthèse vocale FRANÇAISE — aucune
n'existe en wolof. Tu dois donc réécrire ta propre réponse avec l'orthographe
française, pour qu'une voix française la prononce juste.

Quelques correspondances du wolof vers l'écriture française :
  u → ou      (« bu » s'écrit « bou »)
  x → kh      (« xam » s'écrit « kham »)
  ñ → gn      (« ñëw » s'écrit « gneew »)
  ŋ → ng
  c → tch     (« ci » s'écrit « tchi »)
  j → dj      (« jàmm » s'écrit « djamm »)
  ë → eu
  g reste dur (« gi » s'écrit « gui »)
  s reste sourd entre deux voyelles (« asa » s'écrit « assa »)
  une voyelle finale doit s'entendre (« def » reste « def », « ale » → « alé »)

Laisse les mots FRANÇAIS exactement tels qu'ils sont : « contane » reste
« contane », surtout pas « tchontane ». Toi seul sais quels mots sont wolof et
lesquels sont français — c'est pourquoi ce travail te revient.`;

const FORMAT_JSON = `Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
  "wolof": "<transcription fidèle de ce qu'elle vient de dire>",
  "coach": "<ta réponse en wolof, écrite normalement — c'est ce qu'on affichera>",
  "prononciation": "<la même réponse réécrite en orthographe française, pour la voix>",
  "anglais": "<la phrase anglaise à retenir ce tour-ci>",
  "nuance": "<si un réflexe wolof a pollué son anglais, explique-le en wolof ; sinon chaîne vide>"
}

Si l'enregistrement ne contient aucune parole humaine, mets "" dans "wolof".`;

// Les douze derniers tours suffisent à tenir le fil sans alourdir la requête.
function construireHistorique(historique) {
  return (Array.isArray(historique) ? historique : [])
    .slice(-12)
    .filter((tour) => tour && typeof tour.texte === "string" && tour.texte.trim())
    .map((tour) => ({
      role: tour.role === "coach" ? "model" : "user",
      parts: [{ text: String(tour.texte).slice(0, 1200) }],
    }));
}

function extraireReponse(analyse) {
  return {
    wolof: String(analyse.wolof || "").trim(),
    coach: String(analyse.coach || "").trim(),
    prononciation: String(analyse.prononciation || "").trim(),
    anglais: String(analyse.anglais || "").trim(),
    nuance: String(analyse.nuance || "").trim(),
  };
}

// Un seul appel : Gemini écoute le wolof et répond en coach.
// Whisper ne connaît pas le wolof — Gemini, si.
async function interrogerGemini(parts, historique) {
  const resultat = await demanderJson(
    CONSIGNE_COACH + "\n\n" + FORMAT_JSON,
    [...construireHistorique(historique), { role: "user", parts }]
  );

  if (!resultat.ok) {
    return resultat;
  }

  const analyse = extraireReponse(resultat.donnees);

  if (!analyse.wolof) {
    return { ok: false, audioVide: true, details: "Aucune parole détectée." };
  }
  return { ok: true, ...analyse };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée, utilise POST." });
  }

  const { audioBase64, mimeType, historique } = req.body || {};
  if (!audioBase64) {
    return res.status(400).json({ error: "Champ 'audioBase64' manquant dans le corps de la requête." });
  }

  // Seule la clé Gemini est indispensable : Hugging Face n'est qu'un filet de
  // secours, et le navigateur sait lire la leçon si ElevenLabs manque.
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Configuration incomplète",
      details: "Variable d'environnement manquante sur Vercel : GEMINI_API_KEY",
    });
  }

  try {
    // 1. Gemini écoute le wolof et répond en coach, en un seul appel.
    let echange = await interrogerGemini(
      [
        { text: "Voici ce que je te dis maintenant :" },
        { inline_data: { mime_type: mimeType || "audio/wav", data: audioBase64 } },
      ],
      historique
    );

    // 2. Repli : si Gemini a refusé l'audio, Hugging Face transcrit et
    //    Gemini reprend la main sur le texte.
    if (!echange.ok && !echange.quotaAtteint && process.env.HF_API_KEY) {
      const sttResponse = await fetch(HF_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": mimeType || "audio/wav",
        },
        body: Buffer.from(audioBase64, "base64"),
      });

      if (sttResponse.ok) {
        const transcription = (await sttResponse.json()).text || "";
        if (transcription) {
          echange = await interrogerGemini([{ text: transcription }], historique);
        }
      }
    }

    if (!echange.ok) {
      if (echange.quotaAtteint) {
        return res.status(429).json({
          error: "Quota Gemini atteint",
          details: MESSAGE_QUOTA,
        });
      }
      if (echange.audioVide) {
        return res.status(422).json({
          error: "Je n'ai pas bien entendu",
          details: "Réessaie en parlant un peu plus près du micro.",
        });
      }
      return res.status(502).json({
        error: "Le coach n'a pas pu répondre",
        details: String(echange.details || "").slice(0, 300),
      });
    }

    return res.status(200).json({
      wolof: echange.wolof,
      coach: echange.coach,
      prononciation: echange.prononciation || echange.coach,
      anglais: echange.anglais,
      nuance: echange.nuance,
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
