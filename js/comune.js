// Funzioni comuni a tutte le pagine.

export async function sha256(testo) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Deve restare identica a quella delle funzioni lato server.
export function hashSequenza(userId, sequenza) {
  return sha256(`${userId}:${sequenza.join("-")}`);
}

export function tokenCasuale(byte = 32) {
  const a = crypto.getRandomValues(new Uint8Array(byte));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Riduce la foto a max 1920 px sul lato lungo, in JPEG. Restituisce null se il browser
// non riesce a leggerla (in quel caso si carica l'originale, se il formato è accettato).
export async function comprimiImmagine(file, maxLato = 1920, qualita = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const scala = Math.min(1, maxLato / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scala));
    const h = Math.max(1, Math.round(img.naturalHeight * scala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualita));
    return blob || null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const FORMATI_ACCETTATI = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function formattaDataOra(iso) {
  return new Date(iso).toLocaleString("it-IT", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

const MESSAGGI = {
  rete: "Connessione assente. Controlla la rete e riprova.",
  link_non_valido: "Questo link non è attivo. Chiedi un link nuovo a chi te l'ha mandato.",
  link_scaduto: "Il link è scaduto: il caricamento è chiuso.",
  tipo_non_valido: "Formato non supportato. Carica una foto JPG, PNG, WEBP o HEIC.",
  file_troppo_grande: "Foto troppo grande, anche dopo la compressione (massimo 15 MB).",
  caricamento_fallito: "Caricamento non riuscito. Riprova tra poco.",
  non_autenticato: "Sessione scaduta. Accedi di nuovo.",
  solo_owner: "Operazione riservata alla presidenza.",
  gia_convocato: "Il festeggiato è già stato convocato.",
  email_non_valida: "L'email non è valida.",
  email_gia_usata: "Esiste già un account con questa email.",
  password_corta: "La password deve avere almeno 8 caratteri.",
  sequenza_non_valida: "La sequenza deve toccare almeno 4 punti.",
  creazione_fallita: "Non è stato possibile creare l'account. Riprova.",
  nessun_festeggiato: "Nessun festeggiato convocato.",
  conferma_mancante: "Scrivi TRASFERISCI per confermare.",
  trasferimento_fallito: "Trasferimento non riuscito. Nulla è stato modificato.",
  aggiornamento_fallito: "Aggiornamento non riuscito. Riprova.",
  revoca_fallita: "Revoca non riuscita.",
};
export function messaggio(codice) {
  return MESSAGGI[codice] ?? "Qualcosa non ha funzionato. Riprova.";
}

let timerAvviso;
export function avviso(testo, tipo = "info") {
  let el = document.getElementById("avviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "avviso";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = testo;
  el.dataset.tipo = tipo;
  el.classList.add("visibile");
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => el.classList.remove("visibile"), tipo === "errore" ? 7000 : 3200);
}

export async function copiaTesto(testo) {
  try {
    await navigator.clipboard.writeText(testo);
    return true;
  } catch {
    return false;
  }
}

export function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
