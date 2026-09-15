// data/transparents.js
// ════════════════════════════════════════════════════════════════════════
//  LES MOTS QU'IL CONNAÎT DÉJÀ SANS LE SAVOIR
// ════════════════════════════════════════════════════════════════════════
//
// D'après la méthode Michel Thomas, qui ouvre ses cours ainsi :
//   « Vous saviez même pas que vous connaissiez ces mots, hein, en anglais ! »
//
// Le wolof de Dakar a emprunté massivement au français, et le français
// partage des milliers de mots avec l'anglais. Quelqu'un qui dit « je ne
// parle pas un mot d'anglais » en connaît en réalité plusieurs centaines.
// C'est la porte d'entrée la plus motivante qui existe pour un débutant.
//
// ── COMMENT MODIFIER CE FICHIER ─────────────────────────────────────────
// Sur GitHub, clique sur le crayon ✏️, écris, puis « Commit changes ».
// Une minute plus tard le coach en dispose. Pas besoin de savoir coder.
//
// C'est du texte libre : une virgule oubliée ne cassera rien.
// Les lignes vides et celles qui commencent par # sont ignorées.
// ════════════════════════════════════════════════════════════════════════


// ── LES FAMILLES ────────────────────────────────────────────────────────
// La partie la plus puissante : une seule règle ouvre des centaines de mots.
//
//   terminaison | ce qui se passe en anglais | comment ça se prononce | exemples
//
const FAMILLES = `

-able   | s'écrit pareil en anglais | la fin se dit « eu-beul » | possible, probable, capable, acceptable, responsable, confortable, remarquable, considérable, adorable, favorable
-ible   | s'écrit pareil en anglais | la fin se dit « eu-beul » | possible, terrible, visible, horrible, flexible, impossible
-tion   | s'écrit pareil en anglais | la fin se dit « cheune » | situation, information, condition, education, attention, solution, position, action, nation, direction, production
-sion   | s'écrit pareil en anglais | la fin se dit « jeune » | television, decision, occasion, version, mission, discussion
-ent    | s'écrit pareil en anglais | la fin se dit « eunt » | important, different, president, accident, moment, document, client, patient, silent
-ance   | s'écrit pareil en anglais | la fin se dit « eunss » | importance, distance, assurance, performance, balance
-ence   | s'écrit pareil en anglais | la fin se dit « eunss » | difference, experience, patience, science, silence, influence
-al     | s'écrit pareil en anglais | la fin se dit « eul » | normal, total, national, international, social, general, original, animal, local, special, central
-age    | s'écrit pareil en anglais | la fin se dit « idj » | message, village, garage, image, passage, courage, village
-ique   | devient -ic en anglais | la fin se dit « ik » | musique→music, publique→public, politique→politic, plastique→plastic
-té     | devient -ty en anglais | la fin se dit « ti » | université→university, qualité→quality, réalité→reality, société→society, activité→activity

`;


// ── LES MOTS DU QUOTIDIEN ───────────────────────────────────────────────
// Les emprunts déjà installés dans le wolof de Dakar. Vérifie-les : c'est
// toi qui sais comment on parle réellement à Dakar, pas la machine.
//
//   ce qu'il dit déjà | le mot anglais | comment ça se prononce
//
const MOTS = `

taabal      | table      | TÉ-beul
telefon     | telephone  | TÉ-li-fone
tele        | television | TÉ-li-vi-jeune
radio       | radio      | RÉ-di-ô
foto        | photo      | FÔ-tô
doktoor     | doctor     | DOK-teur
loppitaan   | hospital   | HOS-pi-teul
bisikleet   | bicycle    | BAÏ-si-keul
taksi       | taxi       | TAK-si
polis       | police     | peu-LISS
bankë       | bank       | BANK
mashin      | machine    | meu-CHINE
minit       | minute     | MI-nit
restoran    | restaurant | RÈS-teu-rant
otel        | hotel      | hô-TÈL
biro        | office     | O-fiss
lekool      | school     | SKOUL
buteel      | bottle     | BO-teul
sinema      | cinema     | SI-neu-meu
mesaas      | message    | MÈ-sidj
garaas      | garage     | GA-ridj
sak         | bag        | BAG
kaar        | bus        | BEUSS
misik       | music      | MIOU-zik
familia     | family     | FA-mi-li
president   | president  | PRÈ-zi-deunt
problem     | problem    | PRO-bleum
tilibon     | telephone  | TÉ-li-fone

`;


// ── LES FAUX AMIS ───────────────────────────────────────────────────────
// Ceux qui ressemblent mais qui piègent. Michel Thomas les signale tôt,
// avant que l'habitude ne s'installe.
//
//   le mot | ce qu'il croit que ça veut dire | ce que ça veut dire vraiment
//
const FAUX_AMIS = `

sensible     | sensible (qui ressent) | raisonnable. « Sensible » se dit sensitive
librairie    | library                | library est une bibliothèque. Une librairie est un bookshop
actuellement | actually               | actually veut dire « en fait ». Actuellement se dit currently
éventuellement | eventually           | eventually veut dire « finalement ». Éventuellement se dit possibly
demander     | to demand              | to demand est une exigence. Demander se dit to ask
assister     | to assist              | to assist c'est aider. Assister à se dit to attend
prétendre    | to pretend             | to pretend c'est faire semblant. Prétendre se dit to claim
rester       | to rest                | to rest c'est se reposer. Rester se dit to stay
chance       | chance                 | chance c'est le hasard. La chance se dit luck
passer un examen | to pass            | to pass c'est réussir. Passer un examen se dit to take an exam
monnaie      | money                  | money c'est l'argent. La monnaie se dit change

`;


module.exports = { FAMILLES, MOTS, FAUX_AMIS };
