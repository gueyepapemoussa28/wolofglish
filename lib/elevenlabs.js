// lib/elevenlabs.js
// Voix anglaise par ElevenLabs, quand le compte le permet.
//
// Deux pièges rencontrés sur ce projet :
//   - les comptes gratuits refusent les voix de bibliothèque (paid_plan_required) ;
//   - une clé sans la permission « Voices : Read » ne peut pas lister les voix
//     du compte, et l'on se retrouve aveugle avec le seul ELEVENLABS_VOICE_ID.
// D'où l'inventaire joint au message d'échec : il rend ces pannes lisibles.

let voixEnCache = null;

async function listerVoixCandidates() {
  const candidates = [];
  const inventaire = [];
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

  return { voix: [...new Set(candidates.filter(Boolean))].slice(0, 12), inventaire };
}

// Renvoie { ok: true, audio: Buffer } ou { ok: false, details }.
async function synthetiser(texte) {
  if (!process.env.ELEVENLABS_API_KEY || !texte) {
    return { ok: false, details: "Pas de clé ElevenLabs." };
  }

  const { voix: voixDisponibles, inventaire } = await listerVoixCandidates();
  let dernierDetail = "Aucune voix disponible sur ce compte.";

  for (const voixId of voixDisponibles) {
    const reponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voixId}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: texte, model_id: "eleven_multilingual_v2" }),
    });

    if (reponse.ok) {
      voixEnCache = voixId;
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
