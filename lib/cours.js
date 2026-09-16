// lib/cours.js
// Choisit le cours qui sert au moment présent, et le met en forme.
//
// Le coach savait converser mais ne savait pas où aller. Ce module lui donne
// une colonne vertébrale — sans lui retirer sa manière : il suit les étapes,
// il ne les récite pas.
//
// Un seul cours voyage à la fois. Les envoyer tous coûterait cher et le
// perdrait ; il n'a besoin que de celui qu'il est en train de faire.

const { COURS } = require("../data/cours");

let coursEnCache = null;

function decouper() {
  if (coursEnCache) return coursEnCache;

  coursEnCache = String(COURS || "")
    .split(/^=== /m)
    .map((bloc) => bloc.trim())
    .filter(Boolean)
    .map((bloc) => {
      const titre = (bloc.split("===")[0] || "").trim();
      const reste = bloc.slice(bloc.indexOf("===") + 3);
      const objectif = ((reste.match(/OBJECTIF:[^\S\n]*(.*)/) || [])[1] || "").trim();
      const niveau = ((reste.match(/NIVEAU:[^\S\n]*(.*)/) || [])[1] || "").trim();
      const corps = reste
        .replace(/OBJECTIF:.*\n?/, "")
        .replace(/NIVEAU:.*\n?/, "")
        .trim();
      return { titre, objectif, niveau, corps };
    })
    // Le gabarit vide laissé en exemple ne doit jamais être enseigné.
    .filter((c) => c.titre && c.corps && c.objectif);

  return coursEnCache;
}

function titres() {
  return decouper().map((c) => c.titre);
}

// Celui que l'apprenant suit, sinon le premier de son niveau.
function choisir(profil) {
  const liste = decouper();
  if (liste.length === 0) return null;

  const encours = profil && profil.cours;
  if (encours) {
    const trouve = liste.find((c) => c.titre.toLowerCase() === String(encours).toLowerCase());
    if (trouve) return trouve;
  }

  const niveau = (profil && profil.niveau) || "debutant";
  return liste.find((c) => c.niveau === niveau) || liste[0];
}

function decrireCours(profil) {
  const cours = choisir(profil);
  if (!cours) return "";

  const autres = titres().filter((t) => t !== cours.titre);

  return [
    "════════════════════════════════════════════════════════════════",
    "LE COURS QUE VOUS FAITES",
    "════════════════════════════════════════════════════════════════",
    "",
    "Titre : " + cours.titre,
    "But   : " + cours.objectif,
    "",
    "Ce cours a été écrit par un locuteur wolof, pour cet apprenant-là. Son",
    "wolof fait autorité sur le tien, et ses étapes sur ton improvisation.",
    "",
    "MAIS NE LE RÉCITE PAS. C'est une colonne vertébrale, pas un script. Tu",
    "gardes ta manière : tu fais produire, tu corriges par paliers, tu ne",
    "voles jamais la réponse. Tu prends une étape, tu la fais vivre en",
    "conversation, et tu passes à la suivante quand il y arrive.",
    "",
    "Une étape par échange. Jamais deux. S'il t'emmène ailleurs, suis-le un",
    "moment, puis ramène-le à l'étape où vous en étiez.",
    "",
    "Quand tout le cours est acquis, dis-le-lui, et mets le titre du suivant",
    'dans "profil.cours".' + (autres.length ? " Les autres cours : " + autres.join(" · ") + "." : ""),
    "",
    "──────────────────────────────── LE COURS ────────────────────────────",
    cours.corps,
    "──────────────────────────────────────────────────────────────────────",
  ].join("\n");
}

module.exports = { decrireCours, titres, choisir };
