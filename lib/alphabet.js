// lib/alphabet.js
// L'alphabet wolof, transcrit en orthographe française.
//
// C'est ici que vit « la connaissance du wolof » pour la voix. Elle n'est pas
// à collecter mot par mot : l'orthographe officielle du wolof (alphabet du
// CLAD) est РЕGULIÈRE — un signe, un son — là où le français et l'anglais ne
// le sont pas. Trente règles couvrent donc l'essentiel du vocabulaire, et le
// dictionnaire de Moussa ne sert plus qu'aux exceptions qu'il entend.
//
// On ne transcrit QUE les mots reconnus comme wolof : sans ce garde-fou, le
// français qui se mêle à la conversation serait défiguré — « je » deviendrait
// « dje », « une » deviendrait « oune ».

const { MOTS_WOLOF } = require("../data/mots-wolof");
const { formesValidees } = require("./lexique");

let lexiqueEnCache = null;

function lexique() {
  if (lexiqueEnCache) return lexiqueEnCache;
  lexiqueEnCache = new Set(
    String(MOTS_WOLOF || "")
      .split("\n")
      .map((mot) => mot.trim().toLowerCase())
      .filter(Boolean)
  );
  return lexiqueEnCache;
}

// Ces lettres n'existent pas en français : un mot qui en contient est du
// wolof, même s'il manque à la liste.
const SIGNATURE = /[ñŋëó]/;

// Les sons déjà transcrits sont mis à l'abri derrière des jetons : sans cela
// le « eu » produit par ë se ferait manger par la règle du u, et bëgg
// ressortait « bèougg » au lieu de « beugg ».
const ABRI = { EU: "\u0001", OU: "\u0002", GN: "\u0003", NG: "\u0004", KH: "\u0005", TCH: "\u0006", DJ: "\u0007" };

const REGLES = [
  // --- consonnes propres au wolof, mises à l'abri aussitôt ---
  [/ñ/g, ABRI.GN],   // ñëw   → gnew
  [/ŋ/g, ABRI.NG],   // ŋaay  → ngaay
  [/[xq]/g, ABRI.KH], // xam  → kham
  [/c/g, ABRI.TCH],  // ci    → tchi
  [/j/g, ABRI.DJ],   // jàmm  → djamm

  // --- voyelles, les longues d'abord ---
  [/ë/g, ABRI.EU],   // le français n'a pas ce son autrement
  [/à/g, "a"],

  [/ée/g, "é"],
  [/ee/g, "é"],
  [/óo?/g, "ô"],
  [/u/g, ABRI.OU],
  [/e(?![\u0001\u0002éèa])/g, "è"], // le e wolof est ouvert

  // --- ce que la lecture française déformerait ---
  [/g(?=[eèéi\u0001])/g, "gu"],  // « gi » se lirait « ji » : gui
  [/([aeiouéèô])s(?=[aeiouéèô])/g, "$1ss"], // s sourd entre voyelles

  // --- on lève les abris ---
  [/\u0001/g, "eu"], [/\u0002/g, "ou"], [/\u0003/g, "gn"],
  [/\u0004/g, "ng"], [/\u0005/g, "kh"], [/\u0006/g, "tch"], [/\u0007/g, "dj"],
];

// Le français lit mal les syllabes qu'il ne reconnaît pas ; le trait d'union
// l'oblige à les détacher. Mesuré : « liggéey » se lit « ligway », découpé
// il se lit juste. On ne coupe qu'à partir de trois syllabes.
function decouper(mot) {
  const syllabes = mot.match(/[^aeiouéèôy]*[aeiouéèôy]+(?:[^aeiouéèôy](?![aeiouéèôy]))?/gi);
  if (!syllabes || syllabes.length < 3) return mot;
  return syllabes.join("-");
}

function estWolof(mot) {
  const nu = mot.toLowerCase();
  return SIGNATURE.test(nu) || lexique().has(nu);
}

// Les voyelles longues : le français ne les tient pas, on les ramène à une
// seule. MAIS elles portent parfois le sens — « sant naa la » c'est « je te
// remercie », « sant na la » c'est « il te remercie ». On ne touche donc
// jamais à une forme que Moussa a validée lui-même.
const REGLES_LONGUEUR = [
  [/aa/g, "a"],
  [/([éeiou])\1/g, "$1"],
];

let validesEnCache = null;
function estValidee(mot) {
  if (!validesEnCache) validesEnCache = new Set(formesValidees());
  return validesEnCache.has(mot.toLowerCase());
}

// Transcrit un mot wolof. Renvoie null si le mot n'est pas reconnu comme
// wolof : on préfère ne rien faire plutôt que défigurer une phrase.
function transcrire(mot) {
  if (!estWolof(mot)) return null;

  let sortie = mot.toLowerCase();
  if (!estValidee(mot)) {
    REGLES_LONGUEUR.forEach(([motif, vers]) => {
      sortie = sortie.replace(motif, vers);
    });
  }
  REGLES.forEach(([motif, vers]) => {
    sortie = sortie.replace(motif, vers);
  });

  const coupe = decouper(sortie);
  return coupe === mot.toLowerCase() ? null : coupe;
}

module.exports = { transcrire, estWolof };
