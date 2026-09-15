// data/prononciation.js
// ════════════════════════════════════════════════════════════════════════
//  TON DICTIONNAIRE DE PRONONCIATION
// ════════════════════════════════════════════════════════════════════════
//
// Aucune synthèse vocale ne connaît le wolof. Toutes lisent ce qu'on leur
// écrit. Alors on leur écrit le wolof comme il se prononce — et quand elles
// se trompent quand même sur un mot, on le corrige ICI, une fois pour toutes.
//
// C'est la différence entre espérer et décider. Le modèle réécrit le wolof à
// sa façon, qui change d'une fois sur l'autre. Ce fichier, lui, fait loi :
// un mot corrigé ici est corrigé pour toujours, dans toutes les phrases.
//
// ── COMMENT CORRIGER UN MOT ─────────────────────────────────────────────
// Tu entends le coach écorcher un mot ? Ajoute une ligne :
//
//     le mot tel qu'il s'écrit  |  comment il doit se lire
//
// Sur GitHub : crayon ✏️, tu écris, « Commit changes ». Une minute après,
// le coach le prononce juste. Pas besoin de savoir coder.
//
// Le trait d'union sépare les syllabes — il ne se voit jamais à l'écran,
// il ne sert qu'à la voix. Mesuré : « liggéey » se lit « ligway »,
// « li-gaille » se lit juste.
//
// ── LA SEULE MÉTHODE QUI MARCHE : TON OREILLE ───────────────────────────
// N'ajoute jamais un mot par raisonnement. Ajoute-le parce que tu l'as
// entendu de travers.
//
// C'est vérifié : on a essayé de deviner des graphies pour les sons que le
// français ne connaît pas (mb-, nj-, voyelles longues). Toutes ont dégradé
// le résultat. Et on ne peut pas non plus faire juger la machine : elle
// préfère systématiquement l'orthographe officielle du wolof, parce qu'elle
// a été entraînée dessus. Elle n'a pas d'avis sur ce qui SONNE juste.
//
// Donc : tu écoutes, tu entends un mot faux, tu ajoutes une ligne, tu
// réécoutes. Dix mots corrigés à l'oreille valent mieux que cent devinés.
// ════════════════════════════════════════════════════════════════════════


// ── LES MOTS À CORRIGER ─────────────────────────────────────────────────
const MOTS = `

# ---- les réécritures de base, demandées par Moussa dès le départ ----
# « Baax = bakh », pour que ça s'écrive au son. Ce sont de simples
# substitutions de lettres, sans invention.
liggéey    | li-gaille
liggeey    | li-gaille
jërëjëf    | djeureu-djeuf
jerejef    | djeureu-djeuf
baax       | bakh
waxtaan    | wakh-taan
ñaay       | gnaye
jàpp       | diapp
xam        | kham
jàmm       | diam
ñëw        | gnew
waxal      | wakh-al
xalis      | kha-liss
bopp       | bopp
mooy       | moï

# ---- ce qu'il ne faut PAS faire ----
# Essayé le 15/09/2026, et mesuré PIRE : les apostrophes pour attaquer les
# prénasalisées (« m'baa », « n'dank ») et le h muet pour allonger les
# voyelles (« da-hara »). Le mieux est l'ennemi du bien — n'invente pas une
# graphie par raisonnement, ajoute-la parce que tu l'as ENTENDUE fausse.

# ---- ajoute les tiens en dessous ----

`;


// ── LES MOTS À NE JAMAIS TOUCHER ────────────────────────────────────────
// Le wolof de Dakar est plein de français. Ces mots-là doivent être lus à la
// française, sans transformation : « contane » ne doit pas devenir
// « tchontane », ni « je » devenir « dje ».
const INTACTS = `

contane, merci, pardon, bonjour, madame, monsieur, taxi, école, bureau,
travail, rendez-vous, samedi, dimanche, voiture, téléphone, docteur,
restaurant, quartier, marché, argent, famille, français, anglais, wolof,
possible, important, situation, attention, question, table, machine

`;


module.exports = { MOTS, INTACTS };
