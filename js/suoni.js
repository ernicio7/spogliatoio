// Suoni del sito.
// - "gol": file caricato dalla presidenza oppure, se manca, un boato da stadio sintetizzato qui.
// - "inno": solo se caricato dalla presidenza (non viene fornito dal sito).
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

export function sbloccaAudio() {
  const c = contesto();
  if (!c) return;
  if (c.state !== "running") c.resume?.();
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
    } catch { /* file non leggibile: per il gol si usa il suono sintetizzato */ }
  }
}

function riproduci(b, volume = 0.9) {
  const g = ctx.createGain();
  g.gain.value = volume;
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(g).connect(ctx.destination);
  s.start();
  return { sorgente: s, guadagno: g };
}

// Boato dello stadio: rumore filtrato che sale e si spegne, più una trombetta.
function boatoSintetizzato() {
  const ora = ctx.currentTime;
  const durata = 3.6;
  const n = Math.floor(ctx.sampleRate * durata);
  const rumore = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = rumore.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = rumore;
  const banda = ctx.createBiquadFilter();
  banda.type = "bandpass";
  banda.frequency.value = 900;
  banda.Q.value = 0.6;
  const basso = ctx.createBiquadFilter();
  basso.type = "lowpass";
  basso.frequency.setValueAtTime(1800, ora);
  basso.frequency.linearRampToValueAtTime(3200, ora + 0.4);
  const folla = ctx.createGain();
  folla.gain.setValueAtTime(0.0001, ora);
  folla.gain.exponentialRampToValueAtTime(0.9, ora + 0.25);
  folla.gain.setValueAtTime(0.9, ora + 1.4);
  folla.gain.exponentialRampToValueAtTime(0.0001, ora + durata);
  // Ondeggiamento della folla
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.15;
  lfo.connect(lfoG).connect(folla.gain);
  src.connect(banda).connect(basso).connect(folla).connect(ctx.destination);
  src.start(ora);
  lfo.start(ora);
  src.stop(ora + durata);
  lfo.stop(ora + durata);
  // Trombetta: due toni insieme, tre colpi
  for (const [inizio, lungh] of [[0.05, 0.28], [0.42, 0.28], [0.8, 0.9]]) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ora + inizio);
    g.gain.exponentialRampToValueAtTime(0.18, ora + inizio + 0.03);
    g.gain.setValueAtTime(0.18, ora + inizio + lungh - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ora + inizio + lungh);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    for (const f of [311, 392]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.connect(lp);
      o.start(ora + inizio);
      o.stop(ora + inizio + lungh);
    }
    lp.connect(g).connect(ctx.destination);
  }
}

export function suona(tipo) {
  const c = contesto();
  if (!c) return;
  if (c.state !== "running") c.resume?.();
  try {
    if (tipo === "gol") {
      if (buffer.gol) riproduci(buffer.gol, 0.9);
      else boatoSintetizzato();
    } else if (tipo === "inno" && buffer.inno) {
      fermaInno(0);
      innoInCorso = riproduci(buffer.inno, 0.95);
      mostraPillola();
      innoInCorso.sorgente.onended = () => { innoInCorso = null; document.querySelector(".pillola-inno")?.remove(); };
    }
  } catch { /* audio non disponibile */ }
}

export function fermaInno(dissolvenza = 1.2) {
  document.querySelector(".pillola-inno")?.remove();
  if (!innoInCorso || !ctx) return;
  const { sorgente, guadagno } = innoInCorso;
  innoInCorso = null;
  const ora = ctx.currentTime;
  guadagno.gain.setValueAtTime(guadagno.gain.value, ora);
  guadagno.gain.linearRampToValueAtTime(0, ora + dissolvenza);
  try { sorgente.stop(ora + dissolvenza + 0.05); } catch { /* già fermo */ }
}

function mostraPillola() {
  const telefono = document.getElementById("telefono");
  if (!telefono) return;
  const b = document.createElement("button");
  b.className = "pillola-inno";
  b.textContent = "♪ Inno in corso: tocca per fermare";
  b.addEventListener("click", () => fermaInno());
  telefono.append(b);
}
