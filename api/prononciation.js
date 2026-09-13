// api/prononciation.js
// L'apprenant répète la phrase anglaise ; le coach écoute et corrige.
//
// Requête (POST) :
//   { "audioBase64": "...", "mimeType": "audio/wav", "phrase": "<la phrase à dire>" }
//
// Réponse :
//   {
//     "entendu": "<ce que le coach a réellement entendu>",
//     "score":   <0 à 100>,
//     "retour":  "<le retour du coach, en wolof>",
//     "prononciation": "<le même retour, en orthographe française, pour la voix>",
//     "motsACorriger": ["<mot mal prononcé>", ...]
//   }

const { demanderJson, MESSAGE_QUOTA } = require("../lib/gemini");

const CONSIGNE = `Tu es un coach d'anglais sénégalais, chaleureux, qui parle wolof.

Ton élève vient de répéter à voix haute une phrase anglaise que tu lui as apprise.
Écoute son enregistrement et évalue sa prononciation.

COMMENT TU ÉVALUES
- Compare ce que tu entends à la phrase attendue.
- Juge la PRONONCIATION, pas le niveau d'anglais : un accent sénégalais est
  parfaitement légitime, l'objectif est d'être compris, pas d'imiter un Américain.
- Ne relève qu'UN SEUL point à corriger : le plus important. Un élève qui reçoit
  cinq corrections n'en retient aucune.
- Commence toujours par ce qui est réussi. Puis le point à travailler.
- Si c'est bon, dis-le franchement et félicite — ne cherche pas un défaut pour
  avoir quelque chose à dire.

COMMENT TU LE DIS
Ton retour est lu à voix haute : il doit sonner comme un ami qui t'écoute, pas
comme une note en bas d'une copie. Trois ou quatre phrases, le temps d'être
chaleureux — c'est un encouragement, pas un verdict.

Parle-lui directement, avec les mots de tous les jours. Quand tu corriges un
son, dis-lui COMMENT le faire avec sa bouche, en partant d'un son wolof qu'il
connaît déjà. « Mets ta langue entre tes dents » vaut mieux que « le TH est
mal prononcé ».

Et termine en lui donnant envie de réessayer.

LES PIÈGES DU LOCUTEUR WOLOF EN ANGLAIS
Le wolof n'a ni le « th » anglais, ni la distinction entre les voyelles longues
et brèves (ship / sheep), ni le « r » anglais. Les consonnes finales tombent
souvent. Quand tu entends l'un de ces écarts, explique-le en wolof en partant
de ce que ton élève connaît déjà de sa langue.

LE SCORE
0 à 100. Au-dessus de 75, la phrase serait comprise par un anglophone.
En dessous de 40, elle ne le serait pas. Sois juste, ni complaisant ni sévère.

LA PRONONCIATION DE TON RETOUR
Ton retour sera lu par une synthèse vocale FRANÇAISE — aucune n'existe en wolof.
Réécris-le donc en orthographe française dans le champ prévu :
  u → ou, x → kh, ñ → gn, ŋ → ng, c → tch, j → dj, ë → eu,
  g reste dur (« gi » → « gui »), s reste sourd entre voyelles (« asa » → « assa »).
Laisse les mots français et anglais exactement tels quels.

TON FORMAT
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
  "entendu": "<ce que tu as réellement entendu, écrit en anglais>",
  "score": <entier de 0 à 100>,
  "retour": "<ton retour en wolof, chaleureux, 3 à 4 phrases : le réussi, le point à corriger avec le geste à faire, puis l'encouragement>",
  "prononciation": "<le même retour, en orthographe française>",
  "motsACorriger": ["<les mots anglais à retravailler, au plus deux>"]
}

Si l'enregistrement ne contient aucune parole, mets 0 en score et "" dans "entendu".`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée, utilise POST." });
  }

  const { audioBase64, mimeType, phrase } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ error: "Champ 'audioBase64' manquant." });
  }
  if (!phrase || !String(phrase).trim()) {
    return res.status(400).json({ error: "Champ 'phrase' manquant : je ne sais pas quoi évaluer." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Configuration incomplète",
      details: "Variable d'environnement manquante sur Vercel : GEMINI_API_KEY",
    });
  }

  try {
    const resultat = await demanderJson(
      CONSIGNE,
      [
        {
          role: "user",
          parts: [
            { text: `La phrase à dire était : "${String(phrase).trim()}"\n\nVoici ma tentative :` },
            { inline_data: { mime_type: mimeType || "audio/wav", data: audioBase64 } },
          ],
        },
      ],
      0.4 // on veut une évaluation stable, pas créative
    );

    if (!resultat.ok) {
      if (resultat.quotaAtteint) {
        return res.status(429).json({ error: "Quota Gemini atteint", details: MESSAGE_QUOTA });
      }
      return res.status(502).json({
        error: "Le coach n'a pas pu t'écouter",
        details: String(resultat.details || "").slice(0, 300),
      });
    }

    const d = resultat.donnees;
    const entendu = String(d.entendu || "").trim();

    if (!entendu) {
      return res.status(422).json({
        error: "Je n'ai pas bien entendu",
        details: "Réessaie en parlant un peu plus fort, plus près du micro.",
      });
    }

    const score = Math.max(0, Math.min(100, parseInt(d.score, 10) || 0));
    const retour = String(d.retour || "").trim();

    return res.status(200).json({
      entendu,
      score,
      retour,
      prononciation: String(d.prononciation || "").trim() || retour,
      motsACorriger: Array.isArray(d.motsACorriger)
        ? d.motsACorriger.map((m) => String(m).trim()).filter(Boolean).slice(0, 2)
        : [],
    });
  } catch (err) {
    console.error("Erreur prononciation Wolofglish :", err);
    const cause = err && err.cause ? " (" + (err.cause.code || err.cause.message) + ")" : "";
    return res.status(500).json({
      error: "Erreur serveur",
      details: ((err && err.message) || "Exception inconnue") + cause,
    });
  }
};
