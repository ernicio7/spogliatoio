import { supabase } from "./supabase.js";
import { traduci } from "./glossario.js";
import { comprimiImmagine, avviso } from "./comune.js";
import { spazioUsato, aggiungiUsato, LIMITE_BYTE } from "./spazio.js";

export const S = { utente: null, profilo: null, imp: null, prog: null, config: {} };

export const t = (chiave, sost) => traduci(chiave, S.imp?.nomenclatura, sost);
export const nome = () => S.config.nome_festeggiato || "campione";
export const eOwner = () => S.profilo?.ruolo === "owner";

export async function caricaTutto() {
  const uid = S.utente.id;
  const [p, i, g, c] = await Promise.all([
    supabase.from("profili").select("ruolo, email").eq("user_id", uid).maybeSingle(),
    supabase.from("impostazioni").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("progressi").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("config_sito").select("chiave, valore"),
  ]);
  S.profilo = p.data;
  if (!S.profilo) return false;
  S.imp = i.data ?? (await supabase.from("impostazioni").insert({ user_id: uid }).select().single()).data;
  S.prog = g.data ?? (await supabase.from("progressi").insert({ user_id: uid }).select().single()).data;
  S.config = Object.fromEntries((c.data ?? []).map((r) => [r.chiave, r.valore]));
  S.prog.trofei ??= {};
  S.prog.catena ??= {};
  S.prog.indizi ??= {};
  return !!(S.imp && S.prog);
}

// Scrive e verifica che il salvataggio sia avvenuto davvero; in caso contrario lo dice.
async function scrivi(tabella, patch) {
  const { data, error } = await supabase.from(tabella)
    .update({ ...patch, aggiornato_il: new Date().toISOString() })
    .eq("user_id", S.utente.id)
    .select("user_id");
  if (error || !data?.length) {
    avviso(`Salvataggio non riuscito (${tabella}): ${error?.message ?? "nessuna riga aggiornata"}`, "errore");
    return false;
  }
  return true;
}

export async function salvaImp(patch) {
  Object.assign(S.imp, patch);
  return scrivi("impostazioni", patch);
}

export async function salvaProg(patch) {
  Object.assign(S.prog, patch);
  return scrivi("progressi", patch);
}

// ---------- Foto ----------
const cacheUrl = new Map();

export async function urlFirmati(percorsi) {
  const ora = Date.now();
  const mancanti = percorsi.filter((p) => p && !(cacheUrl.get(p)?.scade > ora));
  if (mancanti.length) {
    const { data } = await supabase.storage.from("foto").createSignedUrls(mancanti, 3600);
    for (const f of data ?? []) if (f.signedUrl) cacheUrl.set(f.path, { url: f.signedUrl, scade: ora + 50 * 60 * 1000 });
  }
  return new Map(percorsi.map((p) => [p, cacheUrl.get(p)?.url ?? ""]));
}

export async function urlFirmato(percorso) {
  if (!percorso) return "";
  return (await urlFirmati([percorso])).get(percorso);
}

export async function caricaFile(file, cartella) {
  if ((await spazioUsato()) >= LIMITE_BYTE * 0.95) {
    avviso("Spazio quasi esaurito: caricamento bloccato. Vedi Limiti di questa versione.", "errore");
    return null;
  }
  const blob = (await comprimiImmagine(file)) ?? file;
  const est = blob.type === "image/jpeg" ? "jpg" : (blob.type?.split("/")[1] || "jpg");
  const percorso = `${cartella}/${crypto.randomUUID()}.${est}`;
  const { error } = await supabase.storage.from("foto").upload(percorso, blob, { contentType: blob.type || "image/jpeg" });
  if (error) return null;
  aggiungiUsato(blob.size ?? 0);
  return percorso;
}

// ---------- Trofei ----------
export const TROFEI = [
  { id: "scudetto", nome: "Scudetto", reparto: "Ludoteca" },
  { id: "coppa", nome: "Coppa Italia", reparto: "Garage" },
  { id: "champions", nome: "Champions League", reparto: "Tecnologia" },
];
export const haTrofeo = (id) => !!S.prog?.trofei?.[id];
export const romInstallata = () => !!S.prog?.catena?.rom;
export const aspettoRom = () => romInstallata() && !(Array.isArray(S.imp?.widget) && S.imp.widget.includes("rom"));
export const contaTrofei = () => TROFEI.filter((x) => haTrofeo(x.id)).length;
