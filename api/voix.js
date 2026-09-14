// api/voix.js
// Fabrique la voix d'un texte, à la demande du navigateur.
//
// Cette fonction est volontairement séparée de /api/translate : la synthèse
// prend quelques secondes, et faire attendre le texte pour elle donnait
// l'impression d'un coach lent. Le texte part maintenant immédiatement, la
// voix le rejoint.
//
// Requête (POST) :
//   { "texte": "...", "secours": "<orthographe réécrite>", "langue": "wolof" | "anglais" }
// Réponse : l'audio brut (audio/wav ou audio/mpeg), ou un JSON d'erreur.
//
// L'en-tête X-Voix-Source indique laquelle des voix a répondu, ce qui rend
// diagnosticable un basculement silencieux vers le repli.

const voixGemini = require("../lib/voix");
const elevenlabs = require("../lib/elevenlabs");

const CONSIGNE_WOLOF = "Dis ceci en wolof, chaleureusement, comme un ami qui encourage";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée, utilise POST." });
  }

  const { texte, secours, langue } = req.body || {};
  const contenu = String(texte || "").trim();
  const contenuSecours = String(secours || "").trim();

  if (!contenu) {
    return res.status(400).json({ error: "Champ 'texte' manquant." });
  }
  // Au-delà, ce n'est plus une réplique de conversation.
  if (contenu.length > 1200) {
    return res.status(400).json({ error: "Texte trop long pour être lu." });
  }

  try {
    let resultat = null;
    let source = "";

    if (langue === "anglais") {
      // La voix d'ElevenLabs d'abord si le compte l'autorise, sinon Gemini.
      resultat = await elevenlabs.synthetiser(contenu);
      source = "elevenlabs";

      if (!resultat.ok) {
        resultat = await voixGemini.synthetiser(
          contenu,
          "Read this English sentence clearly and slowly, for a language learner",
          process.env.GEMINI_VOIX_ANGLAISE || "Puck"
        );
        source = "gemini:" + (resultat.modele || "?");
      }
    } else {
      // Gemini est la seule voix qui prononce réellement le wolof.
      resultat = await voixGemini.synthetiser(
        contenu,
        CONSIGNE_WOLOF,
        process.env.GEMINI_VOIX || "Kore"
      );
      source = "gemini:" + (resultat.modele || "?");

      // S'il flanche — son quota est bien plus serré que celui du texte —
      // ElevenLabs lit l'orthographe réécrite à la française. Moins juste
      // qu'une vraie voix wolof, mais nettement meilleur que la synthèse
      // du navigateur, qui était le repli précédent.
      if (!resultat.ok && contenuSecours) {
        resultat = await elevenlabs.synthetiser(contenuSecours);
        source = "elevenlabs-secours";
      }
    }

    if (!resultat.ok) {
      // Le navigateur lira le texte lui-même : ce n'est pas une panne bloquante.
      return res.status(502).json({
        error: "Voix indisponible",
        details: String(resultat.details || "").slice(0, 900),
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", resultat.type || "audio/wav");
    res.setHeader("Content-Length", String(resultat.audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Voix-Source", source);
    return res.end(resultat.audio);
  } catch (err) {
    console.error("Erreur voix Wolofglish :", err);
    return res.status(500).json({
      error: "Erreur serveur",
      details: (err && err.message) || "Exception inconnue",
    });
  }
};
