// api/cours.js
// La liste des cours, pour que l'apprenant voie où il peut aller.
//
// Le moteur savait déjà suivre un cours ; il manquait l'endroit où le
// choisir. Sans cette vue, la matière que Moussa écrit reste invisible pour
// celui qui apprend.
//
// Réponse (GET) : { "cours": [ { titre, objectif, niveau, etapes } ] }

const { titres, choisir } = require("../lib/cours");
const { COURS } = require("../data/cours");

// Le nombre d'étapes se lit dans le corps : les lignes numérotées « 1. »,
// « 2. »… C'est approximatif et c'est suffisant — on veut donner une idée de
// la longueur, pas un décompte exact.
function compterEtapes(corps) {
  const trouve = String(corps || "").match(/^\s*\d+\.\s/gm);
  return trouve ? trouve.length : 0;
}

module.exports = async function handler(req, res) {
  try {
    const blocs = String(COURS || "")
      .split(/^=== /m)
      .map((bloc) => bloc.trim())
      .filter(Boolean)
      .map((bloc) => {
        const titre = (bloc.split("===")[0] || "").trim();
        const reste = bloc.slice(bloc.indexOf("===") + 3);
        return {
          titre,
          objectif: ((reste.match(/OBJECTIF:[^\S\n]*(.*)/) || [])[1] || "").trim(),
          niveau: ((reste.match(/NIVEAU:[^\S\n]*(.*)/) || [])[1] || "").trim(),
          etapes: compterEtapes(reste),
        };
      })
      .filter((c) => c.titre && c.objectif);

    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json({ cours: blocs });
  } catch (err) {
    console.error("Erreur liste des cours :", err);
    return res.status(500).json({ error: "Erreur serveur", details: (err && err.message) || "" });
  }
};
