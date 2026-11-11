// Scaricamento delle foto della serata (caricate dagli ospiti).
// 1) prepara: scarica le foto in memoria, con avanzamento;
// 2) salva: su iPhone/Android il menu Condividi ("Salva immagini" nel Rullino),
//    altrimenti un unico file ZIP. Il menu Condividi va aperto con un tocco,
//    per questo la preparazione e il salvataggio sono due passaggi distinti.
import { supabase } from "./supabase.js";

const MAX_CONDIVISIONE = 60;

export async function fotoSerata() {
  const { data } = await supabase.from("foto").select("percorso, creato_il").eq("origine", "ospite").order("creato_il");
  return data ?? [];
}

export async function preparaFoto(righe, avanzamento = () => {}) {
  const file = [];
  for (let i = 0; i < righe.length; i += 20) {
    const blocco = righe.slice(i, i + 20);
    const { data } = await supabase.storage.from("foto").createSignedUrls(blocco.map((r) => r.percorso), 600);
    for (const f of data ?? []) {
      avanzamento(file.length + 1, righe.length);
      try {
        const blob = await (await fetch(f.signedUrl)).blob();
        const est = (f.path.split(".").pop() || "jpg").toLowerCase();
        const n = String(file.length + 1).padStart(3, "0");
        file.push(new File([blob], `serata-${n}.${est}`, { type: blob.type || "image/jpeg" }));
      } catch { /* foto non raggiungibile: si salta */ }
    }
  }
  return file;
}

export function puoCondividere(file) {
  try {
    return matchMedia("(pointer: coarse)").matches && file.length > 0 && file.length <= MAX_CONDIVISIONE
      && !!navigator.canShare && navigator.canShare({ files: file });
  } catch {
    return false;
  }
}

// Da chiamare direttamente nel tocco dell'utente.
export async function condividi(file) {
  await navigator.share({ files: file, title: "Foto della serata" });
}

export async function scaricaZip(file) {
  const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  const zip = new JSZip();
  for (const f of file) zip.file(f.name, f);
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `foto-serata-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Pulsante completo: "Scarica le foto della serata" -> (iPhone) "Salva nel Rullino" + "Scarica come ZIP"
export function pulsanteScarica(contenitore, { avviso }) {
  contenitore.innerHTML = `<button class="btn" data-scarica>Scarica le foto della serata</button><p class="aiuto" data-stato-scarica></p>`;
  const btn = contenitore.querySelector("[data-scarica]");
  const stato = contenitore.querySelector("[data-stato-scarica]");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const righe = await fotoSerata();
    if (!righe.length) {
      btn.disabled = false;
      stato.textContent = "Ancora nessuna foto della serata.";
      return;
    }
    const file = await preparaFoto(righe, (n, tot) => { stato.textContent = `Preparazione ${n} di ${tot}…`; });
    btn.disabled = false;
    if (!file.length) { stato.textContent = "Non è stato possibile scaricare le foto. Riprova."; return; }
    if (puoCondividere(file)) {
      stato.textContent = `${file.length} foto pronte.`;
      const riga = document.createElement("div");
      riga.className = "riga-btn";
      riga.innerHTML = `<button class="btn" data-rullino>Salva nel Rullino</button><button class="btn secondario" data-zip>Scarica come ZIP</button>`;
      btn.replaceWith(riga);
      riga.querySelector("[data-rullino]").addEventListener("click", async () => {
        try { await condividi(file); } catch (e) {
          if (e?.name !== "AbortError") { avviso("Condivisione non riuscita: provo con lo ZIP."); await scaricaZip(file); }
        }
      });
      riga.querySelector("[data-zip]").addEventListener("click", () => scaricaZip(file));
    } else {
      stato.textContent = `Creazione del file ZIP con ${file.length} foto…`;
      try {
        await scaricaZip(file);
        stato.textContent = `${file.length} foto scaricate in un file ZIP.`;
      } catch {
        stato.textContent = "Creazione dello ZIP non riuscita. Riprova.";
      }
    }
  });
}
