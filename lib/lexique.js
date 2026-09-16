// lib/lexique.js
// Transforme la matière de data/lexique.js en consigne lisible par le modèle.
//
// Le fichier est volontairement du texte libre plutôt que du JSON : Moussa
// l'édite depuis GitHub sans outil, et une virgule oubliée ne doit pas casser
// l'application. On tolère donc tout, et on ignore ce qui ne ressemble à rien.

const { EXPRESSIONS, CONSIGNES, CORRECTIONS } = require("../data/lexique");

function lignesUtiles(bloc) {
  return String(bloc || "")
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne && ligne[0] !== "#");
}

// Une expression s'écrit : wolof | sens | anglais | quand l'employer
function formaterExpression(ligne) {
  const parts = ligne.split("|").map((p) => p.trim());
  if (parts.length < 2) return "- " + ligne; // forme libre, on la garde telle quelle

  const [wolof, sens, anglais, usage] = parts;
  let texte = '- « ' + wolof + ' » : ' + sens;
  if (anglais) texte += ". En anglais : « " + anglais + " »";
  if (usage) texte += ". S'emploie " + usage;
  return texte + ".";
}

// Renvoie la section à insérer dans la consigne, ou "" si rien n'est fourni.
function decrireLexique() {
  const expressions = lignesUtiles(EXPRESSIONS).map(formaterExpression);
  const consignes = lignesUtiles(CONSIGNES).map((l) => "- " + l);

  if (expressions.length === 0 && consignes.length === 0) {
    return "";
  }

  const sections = [
    "════════════════════════════════════════════════════════════════",
    "LA MATIÈRE QU'ON T'A DONNÉE",
    "════════════════════════════════════════════════════════════════",
    "",
    "Ce qui suit vient de quelqu'un qui connaît le wolof mieux que toi. Cette",
    "matière fait AUTORITÉ : elle prime sur ce que tu crois savoir.",
    "",
    "Sers-t'en quand l'occasion se présente, sans la réciter : glisse une",
    "expression dans la conversation quand elle tombe juste, reconnais-la quand",
    "l'apprenant l'emploie, et appuie-toi dessus pour expliquer. Ne force pas",
    "un proverbe là où il n'a rien à faire.",
    "",
    "N'ouvre JAMAIS deux tours de suite par la même expression. Une formule",
    "qui revient à chaque phrase cesse d'être chaleureuse : elle devient un",
    "tic, et on entend la machine derrière.",
    "",
    "Et surtout : si tu ne connais pas une expression qu'il emploie et qu'elle",
    "n'est pas ici, DIS-LE. Demande-lui ce qu'elle veut dire. Inventer un sens",
    "plausible est la pire chose que tu puisses faire — il te croira.",
  ];

  if (expressions.length > 0) {
    sections.push("", "EXPRESSIONS ET PROVERBES :", ...expressions);
  }
  if (consignes.length > 0) {
    sections.push("", "CONSIGNES PARTICULIÈRES, à respecter sans discuter :", ...consignes);
  }

  // Les fautes de wolof relevées à l'oreille. Elles passent en dernier, donc
  // en dernier mot : elles corrigent ce que le modèle croit savoir de la
  // langue, et il les refait tant qu'on ne le reprend pas.
  const corrections = lignesUtiles(CORRECTIONS);
  if (corrections.length > 0) {
    sections.push(
      "",
      "TON WOLOF EST FAUTIF SUR CES POINTS. Ne les refais plus :",
      ...corrections.map((ligne) => {
        const [faux, juste, pourquoi] = ligne.split("|").map((p) => p.trim());
        if (!juste) return "- " + ligne;
        let texte = "- N'écris PAS « " + faux + " ». Écris « " + juste + " »";
        return texte + (pourquoi ? " — " + pourquoi + "." : ".");
      }),
      "",
      "Ces corrections viennent d'un locuteur wolof. Elles ne se discutent",
      "pas, et elles valent partout : dans tes répliques comme dans tes",
      "exemples. Si tu hésites entre deux formes, prends celle d'ici."
    );
  }

  return sections.join("\n");
}

// ── L'AMORÇAGE ────────────────────────────────────────────────────────────
// Une reconnaissance vocale à qui l'on annonce le vocabulaire probable se
// trompe beaucoup moins. Test du 15/09/2026 sur trois phrases wolof :
//   sans amorçage → « dank dank moy djappagolou tignay »
//   avec amorçage → « danke danke moy diapp golo gnaay »
// On extrait donc les mots wolof du lexique pour les souffler au modèle
// juste avant qu'il écoute.

const MOTS_IGNORES = new Set([
  "les", "des", "une", "aux", "par", "pour", "avec", "dans", "que", "qui",
  "est", "sur", "son", "ses", "the", "and", "you", "your", "not",
]);

function motsDuLexique() {
  const mots = [];
  lignesUtiles(EXPRESSIONS).forEach((ligne) => {
    // Seul le premier champ est du wolof ; le reste est traduction et usage.
    const wolof = ligne.split("|")[0];
    wolof
      .toLowerCase()
      .split(/[^a-zàâäéèêëïîôöùûüçñŋ'-]+/i)
      .forEach((mot) => {
        if (mot.length > 2 && !MOTS_IGNORES.has(mot)) mots.push(mot);
      });
  });
  return [...new Set(mots)];
}

// Construit le bloc à glisser JUSTE AVANT l'audio. On y mêle les mots du
// lexique et ceux que l'apprenant a déjà employés : ce sont les mots rares,
// donc précisément ceux que le modèle massacre.
function amorcerEcoute(motsDuProfil) {
  const mots = [...new Set([...(motsDuProfil || []), ...motsDuLexique()])]
    .filter(Boolean)
    .slice(0, 60);

  if (mots.length === 0) return "";

  return [
    "AVANT D'ÉCOUTER — les mots que cette personne emploie :",
    mots.join(", ") + ".",
    "",
    "Si un son ressemble à l'un de ces mots, c'est très probablement lui.",
    "Cela ne t'interdit rien : elle peut dire tout autre chose, et tu écris",
    "alors ce que tu entends. Mais ne transforme pas un de ces mots en",
    "charabia parce qu'il t'est inconnu.",
  ].join("\n");
}

// ── LES CORRECTIONS DE MOUSSA, APPLIQUÉES ────────────────────────────────
// Les écrire dans la consigne ne suffit pas : le modèle les respecte souvent,
// pas toujours. On les applique donc aussi sur son texte, après coup. Une
// consigne se plaide, un remplacement se constate.

let reglesEnCache = null;

function reglesDeCorrection() {
  if (reglesEnCache) return reglesEnCache;
  reglesEnCache = lignesUtiles(CORRECTIONS)
    .map((ligne) => {
      const [faux, juste] = ligne.split("|").map((p) => (p || "").trim());
      if (!faux || !juste) return null;
      // Les formes longues d'abord : « sant na la » avant « na ».
      return { faux: faux, juste: juste, poids: faux.length };
    })
    .filter(Boolean)
    .sort((a, b) => b.poids - a.poids);
  return reglesEnCache;
}

function echapper(texte) {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Remplace les formes fautives par celles que Moussa a validées. La casse de
// la première lettre est conservée : « Sant na la » reste capitalisé.
function corrigerWolof(texte) {
  if (!texte) return "";
  let sortie = String(texte);
  reglesDeCorrection().forEach(({ faux, juste }) => {
    const motif = new RegExp("\\b" + echapper(faux).replace(/\s+/g, "\\s+") + "\\b", "gi");
    sortie = sortie.replace(motif, (trouve) =>
      trouve[0] === trouve[0].toUpperCase() ? juste[0].toUpperCase() + juste.slice(1) : juste
    );
  });
  return sortie;
}

// Les formes que Moussa a validées ne doivent plus être retouchées par les
// règles de l'alphabet : c'est lui l'autorité, pas la règle générale.
function formesValidees() {
  const mots = [];
  reglesDeCorrection().forEach(({ juste }) => {
    juste.split(/\s+/).forEach((mot) => {
      if (mot.length > 1) mots.push(mot.toLowerCase());
    });
  });
  return [...new Set(mots)];
}

module.exports = {
  decrireLexique,
  motsDuLexique,
  amorcerEcoute,
  corrigerWolof,
  formesValidees,
};
