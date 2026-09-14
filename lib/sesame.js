// lib/sesame.js
// Voix par le modèle ouvert de Sesame (CSM-1B).
//
// Sesame ne propose pas d'API publique — leur site annonce des lunettes pour
// 2027 — mais leur modèle conversationnel est ouvert. Sa fiche Hugging Face
// annonce « warm », ce qui trompe : hf-inference ne le sert pas. C'est
// deepinfra qui le sert, via le routeur de Hugging Face.
//
// Le routeur transmet la requête au fournisseur sans traduire le format, et
// chacun a le sien. On essaie donc les combinaisons connues jusqu'à ce qu'une
// réponde, et l'on remonte l'erreur de la dernière en cas d'échec.

const DELAI_MAX_MS = 25000;

const PORTES = [
  {
    url: "https://router.huggingface.co/deepinfra/v1/inference/sesame/csm-1b",
    corps: (texte) => ({ text: texte }),
  },
  {
    url: "https://router.huggingface.co/deepinfra/sesame/csm-1b",
    corps: (texte) => ({ text: texte }),
  },
  {
    url: "https://router.huggingface.co/hf-inference/models/sesame/csm-1b",
    corps: (texte) => ({ inputs: texte }),
  },
];

// Certains fournisseurs renvoient l'audio dans du JSON, encodé en base64 ou
// en URI de données, au lieu de l'envoyer brut.
function extraireAudio(donnees) {
  const champ =
    donnees.audio || donnees.audio_base64 || donnees.output || donnees.data || "";
  if (typeof champ !== "string" || champ.length < 100) return null;

  const separateur = champ.indexOf("base64,");
  const brut = separateur === -1 ? champ : champ.slice(separateur + 7);

  try {
    const audio = Buffer.from(brut, "base64");
    return audio.length > 1000 ? audio : null;
  } catch (err) {
    return null;
  }
}

// Renvoie { ok: true, audio: Buffer, type, porte } ou { ok: false, details }.
async function synthetiser(texte) {
  if (!process.env.HF_API_KEY || !texte) {
    return { ok: false, details: "Pas de clé Hugging Face." };
  }

  let dernierDetail = "Aucune porte n'a répondu.";

  for (const porte of PORTES) {
    const minuteur = new AbortController();
    const echeance = setTimeout(() => minuteur.abort(), DELAI_MAX_MS);

    try {
      const reponse = await fetch(porte.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: minuteur.signal,
        body: JSON.stringify(porte.corps(texte)),
      });

      if (!reponse.ok) {
        dernierDetail = porte.url.split("/").slice(3, 5).join("/") + " → " +
          reponse.status + " " + (await reponse.text()).slice(0, 200);
        continue;
      }

      const type = reponse.headers.get("content-type") || "";

      if (type.indexOf("application/json") !== -1) {
        const donnees = await reponse.json();
        const audio = extraireAudio(donnees);
        if (audio) {
          return { ok: true, audio, type: "audio/wav", porte: porte.url };
        }
        dernierDetail = "JSON sans audio exploitable : " +
          JSON.stringify(donnees).slice(0, 200);
        continue;
      }

      const audio = Buffer.from(await reponse.arrayBuffer());
      if (audio.length < 1000) {
        dernierDetail = "Audio vide (" + audio.length + " octets).";
        continue;
      }
      return { ok: true, audio, type: type || "audio/wav", porte: porte.url };
    } catch (err) {
      dernierDetail =
        err && err.name === "AbortError"
          ? "Dépassement de " + DELAI_MAX_MS / 1000 + " s."
          : (err && err.message) || "Appel impossible.";
    } finally {
      clearTimeout(echeance);
    }
  }

  return { ok: false, details: dernierDetail };
}

module.exports = { synthetiser };
