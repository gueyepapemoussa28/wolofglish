// lib/sesame.js
// Voix par le modèle ouvert de Sesame (CSM-1B), servi par Hugging Face.
//
// Sesame ne propose pas d'API publique — leur site annonce des lunettes pour
// 2027 — mais leur modèle conversationnel est ouvert et, contrairement à tous
// les modèles wolof du catalogue, celui-ci est réellement servi.
//
// Rien ne dit qu'il prononce le wolof : il est entraîné surtout sur l'anglais.
// D'où cet essai, activable explicitement et sans rien changer par défaut.

const SESAME_URL = "https://router.huggingface.co/hf-inference/models/sesame/csm-1b";
const DELAI_MAX_MS = 20000;

// Renvoie { ok: true, audio: Buffer, type } ou { ok: false, details }.
async function synthetiser(texte) {
  if (!process.env.HF_API_KEY || !texte) {
    return { ok: false, details: "Pas de clé Hugging Face." };
  }

  const minuteur = new AbortController();
  const echeance = setTimeout(() => minuteur.abort(), DELAI_MAX_MS);

  try {
    const reponse = await fetch(SESAME_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/wav",
      },
      signal: minuteur.signal,
      body: JSON.stringify({ inputs: texte }),
    });

    if (!reponse.ok) {
      return { ok: false, details: (await reponse.text()).slice(0, 300) };
    }

    const type = reponse.headers.get("content-type") || "audio/wav";

    // Un modèle encore froid répond parfois en JSON pour annoncer son
    // chargement, au lieu de l'audio attendu.
    if (type.indexOf("application/json") !== -1) {
      return { ok: false, details: (await reponse.text()).slice(0, 300) };
    }

    const audio = Buffer.from(await reponse.arrayBuffer());
    if (audio.length < 1000) {
      return { ok: false, details: "Audio vide (" + audio.length + " octets)." };
    }

    return { ok: true, audio, type };
  } catch (err) {
    return {
      ok: false,
      details:
        err && err.name === "AbortError"
          ? "Sesame a dépassé " + DELAI_MAX_MS / 1000 + " s."
          : (err && err.message) || "Appel impossible.",
    };
  } finally {
    clearTimeout(echeance);
  }
}

module.exports = { synthetiser };
