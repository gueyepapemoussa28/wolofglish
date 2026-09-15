// lib/transparents.js
// Met en forme data/transparents.js pour le coach.
//
// Ce qui suit vient de l'analyse d'un extrait de Michel Thomas fourni par
// Moussa : le cours s'ouvre en prouvant à l'élève qu'il connaît déjà des
// centaines de mots. Pour un wolophone, l'effet est encore plus fort que
// pour un francophone, parce que le wolof de Dakar a emprunté au français
// ce que le français partage avec l'anglais.

const { FAMILLES, MOTS, FAUX_AMIS } = require("../data/transparents");

function lignesUtiles(bloc) {
  return String(bloc || "")
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne && ligne[0] !== "#");
}

function champs(ligne) {
  return ligne.split("|").map((p) => p.trim());
}

// Le bloc complet pèse près de six mille caractères : inutile de le
// transporter à chaque tour pour quelqu'un qui parle déjà. On ne garde que
// ce qui sert au niveau où il se trouve.
function decrireTransparents(niveau) {
  const debutant = niveau === "premiers-mots" || niveau === "debutant" || !niveau;
  const moyen = niveau === "debrouille";

  const familles = debutant || moyen ? lignesUtiles(FAMILLES) : [];
  const mots = debutant || moyen ? lignesUtiles(MOTS) : [];
  const pieges = lignesUtiles(FAUX_AMIS);

  if (!familles.length && !mots.length && !pieges.length) return "";

  // Plus haut que « débutant », il n'a plus besoin qu'on le convainque : on
  // ne lui laisse que les pièges.
  if (!debutant && !moyen) {
    return [
      "LES FAUX AMIS — signale-les quand il tombe dedans, jamais en liste :",
      ...pieges.map((ligne) => {
        const [mot, croit, verite] = champs(ligne);
        return "- « " + mot + " » : ce n'est pas " + (croit || "") + ". " + (verite || "");
      }),
    ].join("\n");
  }

  const sections = [
    "════════════════════════════════════════════════════════════════",
    "LES MOTS QU'IL CONNAÎT DÉJÀ SANS LE SAVOIR",
    "════════════════════════════════════════════════════════════════",
    "",
    "Voici ta meilleure porte d'entrée avec un débutant, et de loin.",
    "",
    "Quelqu'un qui te dit « je ne parle pas un mot d'anglais » en connaît en",
    "réalité plusieurs centaines : le wolof de Dakar a emprunté au français,",
    "et le français partage des milliers de mots avec l'anglais.",
    "",
  ];

  if (debutant) {
    sections.push(
      "",
      "Le premier geste, avec un vrai débutant, c'est de le lui PROUVER. Pas de",
      "le lui dire — de le lui faire dire. Demande-lui de traduire « possible »,",
      "« important », « situation ». Il va les dire. Puis fais-lui remarquer ce",
      "qui vient de se passer : il a parlé anglais sans l'avoir appris.",
      "",
      "Cet instant vaut dix leçons. C'est là que quelqu'un décide qu'il en est",
      "capable — ou qu'il abandonne."
    );
  }

  if (familles.length) {
    sections.push(
      "",
      "LES FAMILLES — une seule règle ouvre des centaines de mots :"
    );
    familles.forEach((ligne) => {
      const [fin, quoi, son, exemples] = champs(ligne);
      let texte = "- « " + fin + " » : " + (quoi || "");
      if (son) texte += " — " + son;
      if (exemples) texte += ". Par exemple : " + exemples;
      sections.push(texte);
    });
    sections.push(
      "",
      "Enseigne la FAMILLE, pas le mot. Quand il a compris « -tion », il vient",
      "de gagner cent mots d'un coup, et il le sent."
    );
  }

  if (mots.length) {
    sections.push("", "LES MOTS QU'IL EMPLOIE DÉJÀ EN WOLOF :");
    mots.forEach((ligne) => {
      const [wolof, anglais, son] = champs(ligne);
      sections.push(
        "- il dit « " + wolof + " » → en anglais " + anglais +
          (son ? ", qui se prononce " + son : "")
      );
    });
  }

  if (pieges.length) {
    sections.push(
      "",
      "LES FAUX AMIS — signale-les TÔT, avant que l'habitude ne s'installe :"
    );
    pieges.forEach((ligne) => {
      const [mot, croit, verite] = champs(ligne);
      sections.push("- « " + mot + " » : ce n'est pas " + (croit || "") + ". " + (verite || ""));
    });
    sections.push(
      "",
      "Ne les déballe pas tous d'un coup. Un faux ami se signale au moment où",
      "il tombe dedans, jamais en liste."
    );
  }

  return sections.join("\n");
}

module.exports = { decrireTransparents };
