// lib/prononcer.js
// Applique le dictionnaire de prononciation de Moussa au texte qui part
// vers la synthèse vocale.
//
// Le modèle réécrit déjà le wolof à la française, mais il improvise : le
// même mot ressort différemment d'un tour à l'autre, et certains mots
// reviennent toujours faux. Ce module passe après lui et impose les
// corrections écrites dans data/prononciation.js.
//
// La règle est simple : ce que Moussa a écrit fait loi. Il entend un mot
// de travers, il ajoute une ligne, le mot est juste pour toujours.

const { MOTS, INTACTS } = require("../data/prononciation");
const { transcrire } = require("./alphabet");

let tableEnCache = null;

function normaliser(mot) {
  return String(mot)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // on compare sans les accents
}

function construireTable() {
  if (tableEnCache) return tableEnCache;

  const corrections = new Map();
  String(MOTS || "")
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne && ligne[0] !== "#")
    .forEach((ligne) => {
      const [source, cible] = ligne.split("|").map((p) => (p || "").trim());
      if (source && cible) corrections.set(normaliser(source), cible);
    });

  const intouchables = new Set(
    String(INTACTS || "")
      .split(/[,\n]/)
      .map((mot) => normaliser(mot.trim()))
      .filter(Boolean)
  );

  // Un mot protégé ne doit jamais être corrigé, même s'il figure aussi
  // dans la table : le fichier des mots français a le dernier mot.
  intouchables.forEach((mot) => corrections.delete(mot));

  tableEnCache = { corrections, intouchables };
  return tableEnCache;
}

// Rend à la correction la casse du mot d'origine : « Ndank » reste capitalisé.
function respecterLaCasse(origine, correction) {
  if (origine === origine.toUpperCase() && origine.length > 1) {
    return correction.toUpperCase();
  }
  if (origine[0] === origine[0].toUpperCase()) {
    return correction[0].toUpperCase() + correction.slice(1);
  }
  return correction;
}

// Trois passes, dans cet ordre, et l'ordre est le sens :
//
//   1. les mots protégés — le français ne se touche pas ;
//   2. le dictionnaire de Moussa — ce qu'il a entendu fait loi ;
//   3. les règles de l'alphabet wolof — pour tout le reste.
//
// La troisième passe est la nouveauté : l'orthographe du wolof est régulière,
// un signe pour un son. On n'a donc pas à collecter la prononciation mot par
// mot, il suffit d'encoder l'alphabet. Le dictionnaire ne sert plus qu'aux
// exceptions, et un mot inconnu des deux reste intact plutôt que d'être
// défiguré.
function corriger(texte) {
  if (!texte) return { texte: "", corriges: [], regles: [] };

  const { corrections, intouchables } = construireTable();
  const corriges = [];
  const regles = [];

  const sortie = String(texte).replace(
    /[A-Za-zÀ-ÿŋñ'’-]+/g,
    function (mot) {
      const cle = normaliser(mot.replace(/['’]/g, ""));
      if (intouchables.has(cle)) return mot;

      const trouve = corrections.get(cle) || corrections.get(normaliser(mot));
      if (trouve) {
        corriges.push(mot);
        return respecterLaCasse(mot, trouve);
      }

      const parLaRegle = transcrire(mot);
      if (parLaRegle) {
        regles.push(mot);
        return respecterLaCasse(mot, parLaRegle);
      }

      return mot;
    }
  );

  return { texte: sortie, corriges: corriges, regles: regles };
}

module.exports = { corriger };
