// Spazio occupato nello spazio file di Supabase (piano gratuito: 1 GB).
import { supabase } from "./supabase.js";

const CARTELLE = ["ospiti", "presidenza", "album", "contenuti", "sfondi", "sito"];
export const LIMITE_BYTE = 1024 ** 3;
let memoria = null;

export async function spazioUsato({ forza = false } = {}) {
  if (!forza && memoria && Date.now() - memoria.quando < 5 * 60 * 1000) return memoria.byte;
  let totale = 0;
  for (const cartella of CARTELLE) {
    for (let offset = 0; ; offset += 1000) {
      let risposta;
      try { risposta = await supabase.storage.from("foto").list(cartella, { limit: 1000, offset }); } catch { break; }
      const { data, error } = risposta ?? {};
      if (error || !data?.length) break;
      for (const o of data) totale += Number(o.metadata?.size ?? 0);
      if (data.length < 1000) break;
    }
  }
  memoria = { quando: Date.now(), byte: totale };
  return totale;
}

export function aggiungiUsato(byte) {
  if (memoria) memoria.byte += byte;
}

export function formattaByte(b) {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toLocaleString("it-IT", { maximumFractionDigits: 2 })} GB`;
  return `${Math.round(b / 1024 ** 2).toLocaleString("it-IT")} MB`;
}

export function barraSpazio(byte) {
  const perc = Math.min(100, (byte / LIMITE_BYTE) * 100);
  const livello = perc >= 95 ? "pieno" : perc >= 80 ? "attenzione" : "";
  return `<div class="spazio ${livello}">
    <div class="spazio-testo"><strong>${formattaByte(byte)}</strong> usati su 1 GB (${perc.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%)</div>
    <div class="spazio-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(perc)}"><i style="width:${perc}%"></i></div>
    ${livello === "pieno" ? '<p class="spazio-avviso">Spazio quasi esaurito: i nuovi caricamenti sono bloccati. Elimina qualche file per liberarlo.</p>'
      : livello === "attenzione" ? '<p class="spazio-avviso">Oltre l\'80%: meglio non caricare altro senza prima fare pulizia.</p>' : ""}
  </div>`;
}

export const TESTO_LIMITI = [
  "Il sito usa il piano gratuito di Supabase: 1 GB di spazio per foto, audio e immagini, e 5 GB al mese di traffico in uscita. Ogni volta che una foto viene aperta viene scaricata, e conta nel traffico.",
  "Le foto vengono compresse prima del caricamento, a qualche centinaio di KB l'una: in 1 GB ne stanno all'incirca 1.500-2.500 (stima). Un file audio pesa come decine di foto: meglio pochi e brevi.",
  "L'apertura con il dump e l'album scaricano tutte le foto: più foto ci sono, più traffico consumano a ogni visione.",
  "Il link ospiti non ha un tetto al numero di foto: per 48 ore chiunque lo abbia può caricarne quante vuole.",
  "Il Mister risponde grazie al piano gratuito di Groq, che per questo modello consente 30 richieste e 8.000 token al minuto, 1.000 richieste e 200.000 token al giorno. In pratica sono circa 150-200 messaggi al giorno e 6-7 al minuto (stima), condivisi da chi usa la chiave del regalo; con una chiave personale valgono i limiti di quell'account. Il Mister ha l'agenda piena: le sue risposte giornaliere sono contate, quindi pesa bene le domande.",
  "Se il sito resta inutilizzato per una settimana, Supabase lo mette in pausa: smette di funzionare finché chi gestisce il progetto non lo riattiva dal pannello di Supabase.",
  "Sopra il 95% di spazio usato il sito blocca i nuovi caricamenti. I limiti del piano gratuito possono cambiare: fanno fede le condizioni attuali su supabase.com.",
];
