// Suoni del sito, entrambi caricati dalla presidenza (se mancano, nessun suono):
// - "gol": a ogni trofeo;
// - "inno": al Triplete, si ferma quando si chiude la schermata del Triplete.
// Su iPhone l'audio può partire solo dopo un tocco: il contesto audio si sblocca al primo tocco
// (di solito la sequenza sui tornelli) e da lì i suoni possono partire anche dopo qualche secondo.
import { S, urlFirmato } from "./stato.js";

let ctx = null;
const buffer = {};
let innoInCorso = null;

function contesto() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* non supportato */ }
  ctx = new C();
  return ctx;
}

let sbloccato = false;
export function sbloccaAudio() {
  const c = contesto();
  if (!c) return;
  if (c.state !== "running") c.resume?.();
  if (sbloccato && c.state === "running") return;
  sbloccato = true;
  // Un campione muto: su iOS completa lo sblocco
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch { /* nulla */ }
}

function decodifica(c, dati) {
  return new Promise((ok, ko) => {
    const p = c.decodeAudioData(dati, ok, ko);
    if (p && typeof p.then === "function") p.then(ok, ko);
  });
}

export async function precaricaSuoni() {
  const c = contesto();
  if (!c) return;
  for (const [chiave, nomeBuffer] of [["suono_gol", "gol"], ["inno", "inno"]]) {
    delete buffer[nomeBuffer];
    const percorso = S.config[chiave];
    if (!percorso) continue;
    try {
      const url = await urlFirmato(percorso);
      const dati = await (await fetch(url)).arrayBuffer();
      buffer[nomeBuffer] = await decodifica(c, dati);
    } catch { /* file non leggibile: nessun suono */ }
  }
}

const VOLUME = 0.8;
const MAX_GOL = 8;

// Ogni suono sale da zero e torna a zero: salita = 15% della durata (max 2 s),
// discesa = 25% della durata (max 3 s). Il gol si ferma comunque dopo 8 secondi.
function riproduciConDissolvenze(b, { max = Infinity } = {}) {
  const ora = ctx.currentTime;
  const durata = Math.min(b.duration, max);
  const salita = Math.min(2, durata * 0.15);
  const discesa = Math.min(3, durata * 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ora);
  g.gain.linearRampToValueAtTime(VOLUME, ora + salita);
  g.gain.setValueAtTime(VOLUME, ora + durata - discesa);
  g.gain.linearRampToValueAtTime(0, ora + durata);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(g);
  g.connect(ctx.destination);
  s.start(ora);
  s.stop(ora + durata + 0.05);
  return { sorgente: s, guadagno: g };
}

export function suona(tipo) {
  const c = contesto();
  if (!c) return;
  if (c.state !== "running") c.resume?.();
  try {
    if (tipo === "gol" && buffer.gol) {
      riproduciConDissolvenze(buffer.gol, { max: MAX_GOL });
    } else if (tipo === "inno" && buffer.inno) {
      fermaInno(0.3);
      const inno = riproduciConDissolvenze(buffer.inno);
      innoInCorso = inno;
      inno.sorgente.onended = () => { if (innoInCorso === inno) innoInCorso = null; };
    }
  } catch { /* audio non disponibile */ }
}

export function fermaInno(dissolvenza = 2) {
  if (!innoInCorso || !ctx) return;
  const { sorgente, guadagno } = innoInCorso;
  innoInCorso = null;
  const ora = ctx.currentTime;
  const attuale = guadagno.gain.value;
  guadagno.gain.cancelScheduledValues(ora);
  guadagno.gain.setValueAtTime(attuale, ora);
  guadagno.gain.linearRampToValueAtTime(0, ora + dissolvenza);
  try { sorgente.stop(ora + dissolvenza + 0.05); } catch { /* già fermo */ }
}
