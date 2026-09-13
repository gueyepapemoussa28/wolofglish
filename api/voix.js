// api/voix.js
// Fabrique la voix d'un texte, à la demande du navigateur.
//
// Cette fonction est volontairement séparée de /api/translate : la synthèse
// prend quelques secondes, et faire attendre le texte pour elle donnait
// l'impression d'un coach lent. Le texte part maintenant immédiatement, la
// voix le rejoint.
//
// Requête (POST) : { "texte": "...", "langue": "wolof" | "anglais" }
// Réponse : l'audio brut (audio/wav ou audio/mpeg), ou un JSON d'erreur.

const voixGemini = require("../lib/voix");
const elevenlabs = require("../lib/elevenlabs");

const CONSIGNE_WOLOF = "Dis ceci en wolof, chaleureusement, comme un ami qui encourage";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée, utilise POST." });
  }

  const { texte, langue } = req.body || {};
  const contenu = String(texte || "").trim();

  if (!contenu) {
    return res.status(400).json({ error: "Champ 'texte' manquant." });
  }
  // Au-delà, ce n'est plus une réplique de conversation.
  if (contenu.length > 1200) {
    return res.status(400).json({ error: "Texte trop long pour être lu." });
  }

  try {
    let resultat = null;

    if (langue === "anglais") {
      // La voix d'ElevenLabs d'abord si le compte l'autorise, sinon Gemini.
      resultat = await elevenlabs.synthetiser(contenu);
      if (!resultat.ok) {
        resultat = await voixGemini.synthetiser(
          contenu,
          "Read this English sentence clearly and slowly, for a language learner",
          process.env.GEMINI_VOIX_ANGLAISE || "Puck"
        );
      }
    } else {
      resultat = await voixGemini.synthetiser(
        contenu,
        CONSIGNE_WOLOF,
        process.env.GEMINI_VOIX || "Kore"
      );
    }

    if (!resultat.ok) {
      // Le navigateur lira le texte lui-même : ce n'est pas une panne bloquante.
      return res.status(502).json({
        error: "Voix indisponible",
        details: String(resultat.details || "").slice(0, 400),
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", resultat.type || "audio/wav");
    res.setHeader("Content-Length", String(resultat.audio.length));
    res.setHeader("Cache-Control", "no-store");
    return res.end(resultat.audio);
  } catch (err) {
    console.error("Erreur voix Wolofglish :", err);
    return res.status(500).json({
      error: "Erreur serveur",
      details: (err && err.message) || "Exception inconnue",
    });
  }
};
