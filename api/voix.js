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
const { corriger } = require("../lib/prononcer");

// Le ton demandé se retrouve dans la voix : « chaleureusement, comme un ami
// qui encourage » produisait un enthousiasme fatigant à l'usage.
const CONSIGNE_WOLOF =
  "Lis ceci en wolof d'une voix calme, posée et naturelle, comme quelqu'un qui " +
  "parle à un ami. Ton neutre, sans exagération, sans enthousiasme forcé";

// Dit ce que la réécriture a fait : les mots venus du dictionnaire de Moussa,
// puis le nombre traité par les règles de l'alphabet. Sans ce retour, on ne
// sait pas si une ligne ajoutée au dictionnaire a pris effet.
function resumerCorrections(affine) {
  const bouts = [];
  if (affine.corriges.length) bouts.push("dico: " + affine.corriges.slice(0, 10).join(" "));
  if (affine.regles.length) bouts.push("regles: " + affine.regles.length);
  return bouts.join(" | ");
}

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
    let raisonRepli = "";
    let motsCorriges = "";

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
      // Une voix clonée change la donne : elle porte un vrai timbre sénégalais,
      // répond en quelques centaines de millisecondes et ne dépend d'aucun
      // quota Google. Quand ELEVENLABS_VOICE_WOLOF est renseignée, elle passe
      // donc devant Gemini. Sans elle, rien ne change.
      const voixClonee = process.env.ELEVENLABS_VOICE_WOLOF;

      if (voixClonee && contenuSecours) {
        const affine = corriger(contenuSecours);
        motsCorriges = resumerCorrections(affine);
        resultat = await elevenlabs.synthetiser(affine.texte, "fr", voixClonee);
        source = "voix-clonee";

        if (!resultat.ok) {
          raisonRepli = String(resultat.details || "inconnue").slice(0, 200);
        }
      }

      // Gemini est la seule voix qui prononce réellement le wolof.
      if (!resultat || !resultat.ok) {
        resultat = await voixGemini.synthetiser(
          contenu,
          CONSIGNE_WOLOF,
          process.env.GEMINI_VOIX || "Kore"
        );
        source = "gemini:" + (resultat.modele || "?");
      }

      // S'il flanche — son quota est bien plus serré que celui du texte —
      // ElevenLabs lit l'orthographe réécrite à la française. Moins juste
      // qu'une vraie voix wolof, mais nettement meilleur que la synthèse
      // du navigateur, qui était le repli précédent.
      if (!resultat.ok && contenuSecours) {
        // On garde la raison de l'échec : sans elle, le repli masque la panne.
        if (!raisonRepli) raisonRepli = String(resultat.details || "inconnue").slice(0, 200);

        // Gemini lit le vrai wolof ; ElevenLabs, non — il lit ce qu'on lui
        // écrit. C'est donc ici, et seulement ici, qu'on applique le
        // dictionnaire de prononciation : il passe après la réécriture du
        // modèle et impose les corrections que Moussa a documentées.
        const affine = corriger(contenuSecours);
        motsCorriges = resumerCorrections(affine);

        // Le wolof réécrit se lit avec une phonétique française : sans ce
        // forçage, le moteur le lit à l'anglaise et rend du charabia.
        resultat = await elevenlabs.synthetiser(affine.texte, "fr");
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
    if (raisonRepli) {
      res.setHeader("X-Voix-Repli", encodeURIComponent(raisonRepli));
    }
    // Rend visible ce que le dictionnaire a corrigé : sans cela, on ne sait
    // pas si une ligne ajoutée a bien pris effet.
    if (motsCorriges) {
      res.setHeader("X-Voix-Dico", encodeURIComponent(motsCorriges));
    }
    return res.end(resultat.audio);
  } catch (err) {
    console.error("Erreur voix Wolofglish :", err);
    return res.status(500).json({
      error: "Erreur serveur",
      details: (err && err.message) || "Exception inconnue",
    });
  }
};
