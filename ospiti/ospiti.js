import { chiamaFunzione } from "../js/supabase.js";
import { comprimiImmagine, FORMATI_ACCETTATI, formattaDataOra, messaggio, esc } from "../js/comune.js";

const token = new URLSearchParams(location.hash.slice(1)).get("t") ?? "";
const $ = (id) => document.getElementById(id);
let caricate = 0;
let scadenza = null;

async function verifica() {
  if (!token) return mostraChiuso("link_non_valido");
  const r = await chiamaFunzione("ospiti-upload", { token }, { conSessione: false });
  if (!r.ok) return mostraChiuso(r.errore);
  scadenza = new Date(r.scade_il);
  $("scadenza").textContent = formattaDataOra(r.scade_il);
  if (r.nome) $("nome-album").textContent = r.nome;
  $("intro").textContent = "Biglietto valido. Carica le foto della serata.";
  $("area-carica").classList.remove("nascosto");
}

function mostraChiuso(codice) {
  $("intro").textContent = messaggio(codice);
  $("area-carica").classList.add("nascosto");
}

function aggiungiRiga(file) {
  const li = document.createElement("li");
  const anteprima = URL.createObjectURL(file);
  li.innerHTML = `<img alt="" src="${anteprima}">
    <div><div class="nome-file">${esc(file.name || "foto")}</div><div class="esito">In coda</div></div>`;
  li.querySelector("img").addEventListener("load", () => URL.revokeObjectURL(anteprima), { once: true });
  li.querySelector("img").addEventListener("error", () => { li.querySelector("img").removeAttribute("src"); }, { once: true });
  $("elenco").prepend(li);
  return li.querySelector(".esito");
}

async function caricaUna(file, esito) {
  if (scadenza && scadenza.getTime() < Date.now()) {
    esito.textContent = messaggio("link_scaduto");
    esito.className = "esito ko";
    return;
  }
  esito.textContent = "Preparazione…";
  let blob = await comprimiImmagine(file);
  let nome = "foto.jpg";
  if (!blob) {
    if (!FORMATI_ACCETTATI.includes(file.type)) {
      esito.textContent = messaggio("tipo_non_valido");
      esito.className = "esito ko";
      return;
    }
    blob = file;
    nome = file.name || "foto";
  }
  esito.textContent = "Caricamento…";
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    const form = new FormData();
    form.append("token", token);
    form.append("foto", blob, nome);
    const r = await chiamaFunzione("ospiti-upload", null, { formData: form, conSessione: false });
    if (r.ok) {
      esito.textContent = "In rete";
      esito.className = "esito fatto";
      caricate++;
      $("contatore").textContent = caricate;
      $("riepilogo").classList.remove("nascosto");
      return;
    }
    if (r.errore === "link_scaduto" || r.errore === "link_non_valido") {
      esito.textContent = messaggio(r.errore);
      esito.className = "esito ko";
      return;
    }
    if (tentativo === 2) {
      esito.textContent = messaggio(r.errore);
      esito.className = "esito ko";
    }
  }
}

async function caricaTutte(files) {
  const coda = files.map((f) => ({ file: f, esito: aggiungiRiga(f) }));
  const lavoratore = async () => {
    while (coda.length) {
      const { file, esito } = coda.shift();
      await caricaUna(file, esito);
    }
  };
  await Promise.all([lavoratore(), lavoratore()]);
}

$("scelta").addEventListener("change", (e) => {
  const files = Array.from(e.target.files ?? []);
  e.target.value = "";
  if (files.length) caricaTutte(files);
});

verifica();
