// lib/voix.js
// Synthèse vocale par Gemini.
//
// La documentation Google annonce 89 langues sans citer le wolof — mais elle
// ne cite pas davantage le wolof en compréhension, que Gemini maîtrise
// pourtant. Le seul verdict qui compte est celui de l'oreille : on tente, et
// l'appelant se rabat sur la voix du navigateur si rien ne revient.
//
// Gemini renvoie du PCM brut 16 bits à 24 kHz, qu'aucun navigateur ne sait
// lire tel quel. On l'emballe donc dans un en-tête WAV avant de l'envoyer.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

let modelesTtsEnCache = null;

async function listerModelesTts() {
  if (modelesTtsEnCache) {
    return modelesTtsEnCache;
  }

  const candidats = [];
  if (process.env.GEMINI_TTS_MODEL) {
    candidats.push(process.env.GEMINI_TTS_MODEL);
  }

  try {
    const reponse = await fetch(`${GEMINI_BASE}/models?key=${process.env.GEMINI_API_KEY}`);
    if (reponse.ok) {
      const donnees = await reponse.json();
      (donnees.models || [])
        .map((m) => String(m.name).replace(/^models\//, ""))
        .filter((nom) => nom.includes("tts"))
        // Les modèles « flash » d'abord : moins chers et plus rapides.
        .sort((a, b) => (a.includes("flash") ? 0 : 1) - (b.includes("flash") ? 0 : 1))
        .forEach((nom) => candidats.push(nom));
    }
  } catch (err) {
    // Liste inaccessible : on se rabat sur les noms connus.
  }

  candidats.push("gemini-2.5-flash-preview-tts");
  modelesTtsEnCache = [...new Set(candidats.filter(Boolean))].slice(0, 3);
  return modelesTtsEnCache;
}

// Emballe du PCM 16 bits mono dans un conteneur WAV que tout navigateur lit.
function emballerEnWav(pcm, taux) {
  const entete = Buffer.alloc(44);
  entete.write("RIFF", 0);
  entete.writeUInt32LE(36 + pcm.length, 4);
  entete.write("WAVE", 8);
  entete.write("fmt ", 12);
  entete.writeUInt32LE(16, 16); // taille du bloc fmt
  entete.writeUInt16LE(1, 20); // PCM
  entete.writeUInt16LE(1, 22); // mono
  entete.writeUInt32LE(taux, 24);
  entete.writeUInt32LE(taux * 2, 28); // octets par seconde
  entete.writeUInt16LE(2, 32); // alignement de bloc
  entete.writeUInt16LE(16, 34); // bits par échantillon
  entete.write("data", 36);
  entete.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([entete, pcm]);
}

// Renvoie { ok: true, wavBase64 } ou { ok: false, details }.
async function synthetiser(texte, consigne, voix) {
  if (!texte || !process.env.GEMINI_API_KEY) {
    return { ok: false, details: "Rien à synthétiser." };
  }

  const modeles = await listerModelesTts();
  let dernierDetail = "Aucun modèle de synthèse disponible.";

  for (const modele of modeles) {
    const reponse = await fetch(
      `${GEMINI_BASE}/models/${modele}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: (consigne ? consigne + " : " : "") + texte }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voix || "Kore" } },
            },
          },
        }),
      }
    );

    if (reponse.ok) {
      const donnees = await reponse.json();
      const partie = donnees.candidates?.[0]?.content?.parts?.[0]?.inlineData;

      if (!partie || !partie.data) {
        dernierDetail = "Le modèle " + modele + " n'a renvoyé aucun audio.";
        continue;
      }

      // Le type ressemble à « audio/L16;codec=pcm;rate=24000 ».
      const correspondance = /rate=(\d+)/.exec(partie.mimeType || "");
      const taux = correspondance ? parseInt(correspondance[1], 10) : 24000;

      modelesTtsEnCache = [modele, ...modeles.filter((m) => m !== modele)];
      return {
        ok: true,
        modele,
        wavBase64: emballerEnWav(Buffer.from(partie.data, "base64"), taux).toString("base64"),
      };
    }

    dernierDetail = (await reponse.text()).slice(0, 250);

    if (reponse.status === 404 || reponse.status === 400) {
      continue; // modèle retiré ou refusant l'audio
    }
    break; // quota épuisé ou clé invalide : insister ne servirait à rien
  }

  return { ok: false, details: dernierDetail };
}

module.exports = { synthetiser };
