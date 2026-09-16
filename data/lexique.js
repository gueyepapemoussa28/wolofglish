// data/lexique.js
// ═══════════════════════════════════════════════════════════════════════
//  TA MATIÈRE À TOI
//  C'est ici que tu nourris le coach. Tout ce que tu écris entre les
//  guillemets obliques ` ` plus bas lui est transmis à chaque échange.
//
//  COMMENT MODIFIER CE FICHIER
//  1. Va sur github.com/gueyepapemoussa28/wolofglish/blob/main/data/lexique.js
//  2. Clique sur le crayon ✏️ en haut à droite
//  3. Écris tes lignes, puis clique « Commit changes »
//  4. Attends une minute : le coach a appris.
//
//  RÈGLES D'ÉCRITURE
//  - Une expression par ligne, les parties séparées par une barre |
//  - Les lignes commençant par # sont des notes pour toi, il les ignore
//  - Les lignes vides ne gênent pas
//  - N'écris JAMAIS le caractère ` à l'intérieur : il fermerait le texte
// ═══════════════════════════════════════════════════════════════════════

const EXPRESSIONS = `
# ─────────────────────────────────────────────────────────────────────
# EXPRESSIONS, PROVERBES, TOURNURES
# Forme :  wolof | ce que ça veut dire | l'équivalent anglais | quand l'employer
# ─────────────────────────────────────────────────────────────────────

Ndank ndank mooy japp golo ci ñaay | Doucement doucement on attrape le singe dans la brousse | Slow and steady wins the race | pour encourager la patience, quand quelqu'un veut aller trop vite

Nit nitay garabam | L'homme est le remède de l'homme | It takes a village | sur l'entraide, la solidarité

Ku yeewu yeewi | Qui se réveille tôt réussit | The early bird catches the worm | sur le travail, la ponctualité

Teraanga | L'hospitalité sénégalaise, l'art d'accueillir | Senegalese hospitality | quand on parle d'accueil, de recevoir quelqu'un

Inchallah | Si Dieu le veut | God willing / hopefully | se place après un projet futur, très courant à Dakar

Sant Yalla | Rendre grâce à Dieu | Thank God | en réponse à « comment vas-tu », très courant
`;

const CONSIGNES = `
# ---- relevé par Moussa le 16/09/2026 ----
Pour traduire « I'm [nom] », dis « [nom] laa tudd » ou « man la [nom] ». La forme courte « [nom] laa » passe aussi en conversation.
Pour demander le nom de quelqu'un, dis « Noo tudd ? » ou « Naka nga tudd ? ». Jamais « Na nga tudd ».

# ─────────────────────────────────────────────────────────────────────
# TES CONSIGNES AU COACH
# Écris ici ce que tu veux qu'il fasse ou cesse de faire.
# Une consigne par ligne, en français ou en wolof, comme tu veux.
# ─────────────────────────────────────────────────────────────────────

Ne jamais dire « ñëw » pour « viens » à un aîné : dire « ñëwal » est plus respectueux.

Quand l'apprenant salue, répondre à la sénégalaise avant de passer à l'anglais : on ne coupe pas les salutations.
`;

// ── LE WOLOF QU'IL ÉCRIT MAL ────────────────────────────────────────────
// Le coach n'est pas wolophone : il écrit un wolof approximatif, et il le
// refait tant qu'on ne le reprend pas. C'est ici qu'on le reprend.
//
// Quand tu le vois écrire une forme fautive, ajoute une ligne :
//
//     ce qu'il écrit  |  ce qu'il faut écrire  |  pourquoi (facultatif)
//
// C'est toi l'autorité. Ce fichier prime sur ce qu'il croit savoir.
//
const CORRECTIONS = `

# ---- relevé par Moussa le 16/09/2026 ----
sant na la     | sant naa la  | « naa » c'est je, « na » c'est il ou elle
waxal ko       | waxat ko
dama dem ci liggéey | damay dem liggéey yi
bougg naa      | bëgg naa
mena wakh      | mënn a wax
na nga tudd    | noo tudd       | « Naka nga tudd » est juste aussi ; « na nga tudd » ne l'est pas

# ---- ajoute les tiennes en dessous ----

`;


module.exports = { EXPRESSIONS, CONSIGNES, CORRECTIONS };
