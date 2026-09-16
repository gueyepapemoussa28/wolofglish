// lib/elevenlabs.js
// Voix anglaise par ElevenLabs, quand le compte le permet.
//
// Deux pièges rencontrés sur ce projet :
//   - les comptes gratuits refusent les voix de bibliothèque (paid_plan_required) ;
//   - une clé sans la permission « Voices : Read » ne peut pas lister les voix
//     du compte, et l'on se retrouve aveugle avec le seul ELEVENLABS_VOICE_ID.
// D'où l'inventaire joint au message d'échec : il rend ces pannes lisibles.

// Voix vérifiées comme utilisables sur l'offre gratuite le 15/09/2026. Elles
// sont écrites en dur parce que la clé n'a pas la permission voices_read : sans
// cette liste, une voix de bibliothèque périmée laisse le produit muet.
// Vérifiées comme REFUSÉES le même jour : Josh, Sam, Elli, Domi, Rachel,
// Charlotte — inutile de les réessayer.
const VOIX_SURES = [
  "onwK4e9ZLuTAKqWW03F9", // Daniel  — grave et posé
  "ErXwobaYiN019PkySvjV", // Antoni  — le plus rapide au test
  "pNInz6obpgDQGcFmaJgB", // Adam
  "N2lVS1w4EtoT3dr4eOWO", // Callum
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "VR6AewLTigWG4xSOukaG", // Arnold
];

// eleven_flash_v2_5 répond en 300 à 500 ms là où multilingual_v2 met plusieurs
// secondes. Pour une conversation, la vitesse prime sur le grain de la voix.
const MODELE = "eleven_flash_v2_5";

let voixEnCache = null;

async function listerVoixCandidates(voixImposee) {
  const candidates = [];
  const inventaire = [];
  // Une voix clonée passe avant tout le reste : c'est un choix, pas un repli.
  if (voixImposee) candidates.push(voixImposee);
  if (voixEnCache) candidates.push(voixEnCache);
  if (process.env.ELEVENLABS_VOICE_ID) candidates.push(process.env.ELEVENLABS_VOICE_ID);

  try {
    const reponse = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    });

    if (reponse.ok) {
      const donnees = await reponse.json();
      // Les voix appartenant au compte passent avant celles de la bibliothèque,
      // seules les premières étant utilisables en offre gratuite.
      const ordre = ["generated", "cloned", "professional", "personal", "premade"];
      const rang = (categorie) => {
        const index = ordre.indexOf(categorie);
        return index === -1 ? ordre.length : index;
      };
      (donnees.voices || [])
        .slice()
        .sort((a, b) => rang(a.category) - rang(b.category))
        .forEach((voix) => {
          candidates.push(voix.voice_id);
          inventaire.push((voix.name || "?") + " [" + (voix.category || "sans catégorie") + "]");
        });
    } else {
      inventaire.push("liste refusée : HTTP " + reponse.status);
    }
  } catch (err) {
    inventaire.push("liste inaccessible");
  }

  VOIX_SURES.forEach((id) => candidates.push(id));
  return { voix: [...new Set(candidates.filter(Boolean))].slice(0, 12), inventaire };
}

// Renvoie { ok: true, audio: Buffer } ou { ok: false, details }.
// langue : "fr" fait lire le wolof réécrit avec une phonétique française, ce
// qui le rend nettement plus juste — mesuré le 15/09/2026 par aller-retour.
async function synthetiser(texte, langue, voixImposee) {
  if (!process.env.ELEVENLABS_API_KEY || !texte) {
    return { ok: false, details: "Pas de clé ElevenLabs." };
  }

  const { voix: voixDisponibles, inventaire } = await listerVoixCandidates(voixImposee);
  let dernierDetail = "Aucune voix disponible sur ce compte.";

  for (const voixId of voixDisponibles) {
    const reponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voixId}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(
        langue
          ? { text: texte, model_id: MODELE, language_code: langue }
          : { text: texte, model_id: MODELE }
      ),
    });

    if (reponse.ok) {
      if (voixId !== voixImposee) voixEnCache = voixId;
      return { ok: true, audio: Buffer.from(await reponse.arrayBuffer()), type: "audio/mpeg" };
    }

    dernierDetail = await reponse.text();
    if (voixEnCache === voixId) voixEnCache = null;

    // Voix réservée aux offres payantes : la suivante passera peut-être.
    // Toute autre erreur ne se règle pas en changeant de voix.
    if (dernierDetail.indexOf("paid_plan_required") === -1) break;
  }

  return {
    ok: false,
    details:
      voixDisponibles.length + " voix essayée(s). Compte : " +
      (inventaire.join(", ") || "aucune voix listée") + " || " + dernierDetail,
  };
}

module.exports = { synthetiser };
