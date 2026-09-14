// lib/lexique.js
// Transforme la matière de data/lexique.js en consigne lisible par le modèle.
//
// Le fichier est volontairement du texte libre plutôt que du JSON : Moussa
// l'édite depuis GitHub sans outil, et une virgule oubliée ne doit pas casser
// l'application. On tolère donc tout, et on ignore ce qui ne ressemble à rien.

const { EXPRESSIONS, CONSIGNES } = require("../data/lexique");

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

  return sections.join("\n");
}

module.exports = { decrireLexique };
