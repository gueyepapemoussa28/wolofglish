// lib/gemini.js
// Point d'entrée unique vers Gemini, partagé par les fonctions de l'API.
//
// Deux difficultés récurrentes sont traitées ici une fois pour toutes :
//   - les noms de modèles changent au fil des mois (gemini-2.0-flash a été retiré) ;
//   - le quota gratuit se heurte vite à une 429.
// On découvre donc les modèles disponibles pour la clé et on les essaie en
// plaçant les plus légers d'abord, ce sont eux qui ont les quotas les plus larges.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

let modelesEnCache = null;

async function listerModeles() {
  if (modelesEnCache) {
    return modelesEnCache;
  }

  const candidats = [];
  if (process.env.GEMINI_MODEL) {
    candidats.push(process.env.GEMINI_MODEL);
  }

  try {
    const reponse = await fetch(`${GEMINI_BASE}/models?key=${process.env.GEMINI_API_KEY}`);
    if (reponse.ok) {
      const donnees = await reponse.json();
      const rang = (nom) => {
        if (nom.includes("flash-lite")) return 0;
        if (nom.includes("flash")) return 1;
        return 2;
      };
      (donnees.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => String(m.name).replace(/^models\//, ""))
        .filter((nom) => !nom.includes("tts") && !nom.includes("embedding"))
        .sort((a, b) => rang(a) - rang(b))
        .forEach((nom) => candidats.push(nom));
    }
  } catch (err) {
    // Liste inaccessible : on se rabat sur les noms connus.
  }

  candidats.push("gemini-3.6-flash");
  modelesEnCache = [...new Set(candidats.filter(Boolean))].slice(0, 4);
  return modelesEnCache;
}

// Interroge Gemini en attendant un objet JSON en retour.
// Renvoie { ok: true, donnees } ou { ok: false, quotaAtteint, details }.
async function demanderJson(consigne, contents, temperature) {
  const modeles = await listerModeles();
  let dernierDetail = "";
  let quotaAtteint = false;

  for (const modele of modeles) {
    const reponse = await fetch(
      `${GEMINI_BASE}/models/${modele}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: consigne }] },
          contents,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: typeof temperature === "number" ? temperature : 0.9,
          },
        }),
      }
    );

    if (reponse.ok) {
      const enveloppe = await reponse.json();
      const brut = enveloppe.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let donnees = null;
      try {
        donnees = JSON.parse(brut);
      } catch (err) {
        donnees = null;
      }

      if (!donnees || typeof donnees !== "object") {
        dernierDetail = "Réponse JSON illisible du modèle " + modele + ".";
        continue;
      }

      // On retient le modèle qui a répondu pour les appels suivants.
      modelesEnCache = [modele, ...modeles.filter((m) => m !== modele)];
      return { ok: true, donnees };
    }

    dernierDetail = await reponse.text();

    if (reponse.status === 429) {
      quotaAtteint = true;
      continue; // un modèle plus léger a peut-être encore du quota
    }
    if (reponse.status === 404 || reponse.status === 400) {
      continue; // modèle retiré, ou qui n'accepte pas ce type d'entrée
    }
    break; // clé invalide : changer de modèle n'y fera rien
  }

  return { ok: false, quotaAtteint, details: dernierDetail };
}

const MESSAGE_QUOTA =
  "Le quota gratuit de l'API Google est épuisé. Les limites par minute se " +
  "libèrent au bout d'une minute ; les limites journalières repartent à " +
  "minuit, heure du Pacifique (9h heure de Dakar).";

module.exports = { demanderJson, MESSAGE_QUOTA };
