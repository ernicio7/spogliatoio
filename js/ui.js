import { icona } from "./glossario.js";
import { S, t, salvaProg, TROFEI, contaTrofei, nome, urlFirmato } from "./stato.js";
import { esc, avviso } from "./comune.js";
import { suona } from "./suoni.js";

export const $ = (sel, radice = document) => radice.querySelector(sel);
export function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

let schermo = null;
export const impostaSchermo = (nodo) => { schermo = nodo; };
export const getSchermo = () => schermo;

// ---------- Livelli (app, moduli) collegati al tasto indietro ----------
const pila = [];
history.replaceState({ livello: 0 }, "");

export function apriLivello(nodo) {
  pila.push(nodo);
  schermo.appendChild(nodo);
  requestAnimationFrame(() => requestAnimationFrame(() => nodo.classList.add("aperto")));
  history.pushState({ livello: pila.length }, "");
}

function chiudiNodo(nodo) {
  nodo.classList.remove("aperto");
  nodo.dispatchEvent(new Event("chiuso"));
  setTimeout(() => nodo.remove(), 260);
}

window.addEventListener("popstate", (e) => {
  const obiettivo = e.state?.livello ?? 0;
  while (pila.length > obiettivo) chiudiNodo(pila.pop());
});

export function indietro() { if (pila.length) history.back(); }
export function tornaHome() { if (pila.length) history.go(-pila.length); }
export const livelliAperti = () => pila.length;

// Pannello a schermo intero per un'app
export function pannello(titolo, { classe = "" } = {}) {
  const nodo = el(`<section class="pannello ${classe}" role="dialog" aria-label="${esc(titolo)}">
    <header class="testata-app">
      <button class="btn-icona" data-indietro aria-label="Indietro">${icona("indietro")}</button>
      <h2 class="titolo-app">${esc(titolo)}</h2>
      <div class="azioni-app"></div>
    </header>
    <div class="corpo-app"></div>
  </section>`);
  nodo.querySelector("[data-indietro]").addEventListener("click", indietro);
  apriLivello(nodo);
  return {
    nodo,
    corpo: nodo.querySelector(".corpo-app"),
    azioni: nodo.querySelector(".azioni-app"),
    titolo: (testo) => { nodo.querySelector(".titolo-app").textContent = testo; },
  };
}

// ---------- Modulo a scomparsa dal basso ----------
// campi: { id, etichetta, tipo, valore, aiuto, obbligatorio, min, max, unita, suggerimenti, opzioni, segnaposto }
// tipi: testo | area | scelta | spunta | foto | password | data | anno | intero | decimale
const numeroIt = (n) => (n == null || n === "" ? "" : String(n).replace(".", ","));

function htmlCampo(c, id) {
  const val = c.valore ?? "";
  const lista = c.suggerimenti?.length ? `list="dl-${id}"` : "";
  const datalist = c.suggerimenti?.length
    ? `<datalist id="dl-${id}">${c.suggerimenti.map((x) => `<option value="${esc(x)}"></option>`).join("")}</datalist>` : "";
  const req = c.obbligatorio ? "required aria-required=\"true\"" : "";
  const ph = c.segnaposto ? `placeholder="${esc(c.segnaposto)}"` : "";
  const mm = `${c.min != null ? `min="${c.min}"` : ""} ${c.max != null ? `max="${c.max}"` : ""}`;
  let input;
  switch (c.tipo) {
    case "area":
      return `<textarea id="${id}" rows="3" ${req} ${ph}>${esc(val)}</textarea>`;
    case "scelta":
      return `<select id="${id}" ${req}>${c.opzioni.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    case "spunta":
      return `<label class="spunta"><input id="${id}" type="checkbox" ${val ? "checked" : ""}> ${esc(c.testoSpunta ?? "")}</label>`;
    case "foto":
      return `<div class="campo-foto"><img alt="" class="${val ? "" : "nascosto"}"><input id="${id}" type="file" accept="image/*" class="file-nascosto"><label for="${id}" class="btn secondario">${icona("camera")} ${val ? "Cambia foto" : "Aggiungi foto"}</label></div>`;
    case "data":
      input = `<input id="${id}" type="date" value="${esc(val)}" ${mm} ${req}>`;
      break;
    case "anno":
    case "intero":
      input = `<input id="${id}" type="number" inputmode="numeric" pattern="[0-9]*" step="1" value="${esc(val)}" ${mm} ${req} ${ph} ${lista}>`;
      break;
    case "decimale":
      input = `<input id="${id}" type="text" inputmode="decimal" value="${esc(numeroIt(val))}" ${req} ${ph}>`;
      break;
    case "password":
      input = `<input id="${id}" type="password" value="${esc(val)}" autocomplete="new-password" ${req}>`;
      break;
    default:
      input = `<input id="${id}" type="text" value="${esc(val)}" autocomplete="off" ${req} ${ph} ${lista}>`;
  }
  const conUnita = c.unita ? `<div class="con-unita">${input}<span class="unita">${esc(c.unita)}</span></div>` : input;
  return conUnita + datalist;
}

function leggiEValida(c, input) {
  if (c.tipo === "spunta") return { valore: input.checked };
  const grezzo = (input.value ?? "").trim();
  const vuoto = grezzo === "" && !input.validity?.badInput;
  if (vuoto) return c.obbligatorio ? { errore: "Campo obbligatorio." } : { valore: null };
  const fuori = (n) => (c.min != null && n < c.min) || (c.max != null && n > c.max);
  const intervallo = () => (c.min != null && c.max != null
    ? `Inserisci un valore tra ${numeroIt(c.min)} e ${numeroIt(c.max)}.`
    : c.min != null ? `Il valore minimo è ${numeroIt(c.min)}.` : `Il valore massimo è ${numeroIt(c.max)}.`);
  if (c.tipo === "anno" || c.tipo === "intero") {
    if (input.validity?.badInput || !/^-?\d+$/.test(grezzo)) return { errore: "Inserisci un numero intero, senza lettere." };
    const n = Number(grezzo);
    return fuori(n) ? { errore: intervallo() } : { valore: n };
  }
  if (c.tipo === "decimale") {
    const norm = grezzo.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(norm)) return { errore: "Inserisci un numero, per esempio 6,1." };
    const n = Number(norm);
    return fuori(n) ? { errore: intervallo() } : { valore: n };
  }
  if (c.tipo === "data") {
    if (input.validity?.badInput || !/^\d{4}-\d{2}-\d{2}$/.test(grezzo)) return { errore: "Data non valida." };
    if ((c.min && grezzo < c.min) || (c.max && grezzo > c.max)) return { errore: "Data fuori dall'intervallo consentito." };
    return { valore: grezzo };
  }
  return { valore: grezzo };
}

export function modulo({ titolo, campi, salva, elimina = null, testoSalva = "Salva", controllo = null }) {
  const nodo = el(`<section class="foglio" role="dialog" aria-label="${esc(titolo)}">
    <div class="foglio-velo" data-chiudi></div>
    <form class="foglio-corpo" novalidate>
      <div class="foglio-maniglia" aria-hidden="true"></div>
      <h3>${esc(titolo)}</h3>
      <div class="campi"></div>
      <div class="riga-btn">
        <button class="btn grande" type="submit">${esc(testoSalva)}</button>
        ${elimina ? `<button class="btn secondario pericolo-testo" type="button" data-elimina>${icona("cestino")} Elimina</button>` : ""}
      </div>
    </form>
  </section>`);
  const contenitore = nodo.querySelector(".campi");
  const fileScelti = {};
  for (const c of campi) {
    const id = `campo-${c.id}`;
    const etichetta = c.tipo === "spunta" ? "" : `<label for="${id}">${esc(c.etichetta)}${c.obbligatorio ? ' <span class="obbl">obbligatorio</span>' : ""}</label>`;
    const blocco = el(`<div class="campo" data-campo="${esc(c.id)}">${etichetta}${htmlCampo(c, id)}${c.aiuto ? `<p class="aiuto">${esc(c.aiuto)}</p>` : ""}<p class="errore-campo" id="err-${id}" aria-live="polite"></p></div>`);
    blocco.querySelector(`#${id}`)?.setAttribute("aria-describedby", `err-${id}`);
    contenitore.appendChild(blocco);
    if (c.tipo === "foto") {
      const img = blocco.querySelector("img");
      if (c.valore) urlFirmato(c.valore).then((u) => { img.src = u; });
      blocco.querySelector("input").addEventListener("change", (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        fileScelti[c.id] = f;
        img.src = URL.createObjectURL(f);
        img.classList.remove("nascosto");
      });
    }
  }
  nodo.querySelector("[data-chiudi]").addEventListener("click", indietro);
  nodo.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const valori = {};
    const errori = {};
    for (const c of campi) {
      const input = nodo.querySelector(`#campo-${c.id}`);
      if (c.tipo === "foto") { valori[c.id] = fileScelti[c.id] ? { file: fileScelti[c.id] } : (c.valore ?? null); continue; }
      const r = leggiEValida(c, input);
      if (r.errore) errori[c.id] = r.errore; else valori[c.id] = r.valore;
    }
    if (!Object.keys(errori).length && controllo) Object.assign(errori, controllo(valori) ?? {});
    for (const c of campi) {
      const input = nodo.querySelector(`#campo-${c.id}`);
      const msg = errori[c.id] ?? "";
      const p = nodo.querySelector(`#err-campo-${c.id}`);
      if (p) p.textContent = msg;
      input?.setAttribute("aria-invalid", msg ? "true" : "false");
    }
    const primo = campi.find((c) => errori[c.id]);
    if (primo) {
      nodo.querySelector(`#campo-${primo.id}`)?.focus();
      avviso("Controlla i campi evidenziati.", "errore");
      return;
    }
    const btn = e.submitter ?? nodo.querySelector("[type=submit]");
    btn.disabled = true;
    const ok = await salva(valori);
    btn.disabled = false;
    if (ok !== false) indietro();
  });
  nodo.querySelector("[data-elimina]")?.addEventListener("click", async () => {
    if (!confirm("Eliminare definitivamente?")) return;
    if ((await elimina()) !== false) indietro();
  });
  apriLivello(nodo);
  return nodo;
}

// ---------- Conferma con due pulsanti (restituisce true/false) ----------
export function conferma({ titolo, testo, si = "Conferma", no = "Annulla", pericolo = false }) {
  return new Promise((risolvi) => {
    const nodo = el(`<div class="sovrapposizione" role="alertdialog" aria-modal="true" aria-labelledby="conferma-titolo" aria-describedby="conferma-testo">
      <div class="conferma-box">
        <h2 id="conferma-titolo">${esc(titolo)}</h2>
        <p id="conferma-testo">${esc(testo)}</p>
        <div class="riga-btn"><button class="btn secondario" data-no>${esc(no)}</button><button class="btn ${pericolo ? "pericolo" : ""}" data-si>${esc(si)}</button></div>
      </div>
    </div>`);
    schermo.appendChild(nodo);
    requestAnimationFrame(() => requestAnimationFrame(() => nodo.classList.add("aperto")));
    const chiudi = (valore) => {
      nodo.classList.remove("aperto");
      setTimeout(() => nodo.remove(), 300);
      risolvi(valore);
    };
    nodo.querySelector("[data-no]").addEventListener("click", () => chiudi(false));
    nodo.querySelector("[data-si]").addEventListener("click", () => chiudi(true));
    nodo.querySelector("[data-no]").focus();
  });
}

// ---------- Sovrapposizioni modali (non nella cronologia) ----------
export function sovrapposizione(html, { classe = "" } = {}) {
  return new Promise((risolvi) => {
    const nodo = el(`<div class="sovrapposizione ${classe}" role="dialog" aria-modal="true">${html}</div>`);
    schermo.appendChild(nodo);
    requestAnimationFrame(() => requestAnimationFrame(() => nodo.classList.add("aperto")));
    const chiudi = () => {
      nodo.classList.remove("aperto");
      setTimeout(() => nodo.remove(), 300);
      risolvi();
    };
    nodo.querySelectorAll("[data-chiudi]").forEach((b) => b.addEventListener("click", chiudi));
    nodo.querySelector("[data-chiudi]")?.focus();
  });
}

function coriandoli(n = 46) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const colore = ["#1a5fd0", "#000", "#e0b43c", "#eef2f8"][i % 4];
    s += `<i style="left:${Math.random() * 100}%;background:${colore};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 1.6).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`;
  }
  return `<div class="coriandoli" aria-hidden="true">${s}</div>`;
}

export async function assegnaTrofeo(id) {
  if (S.prog.trofei?.[id]) return;
  const trofei = { ...S.prog.trofei, [id]: new Date().toISOString() };
  await salvaProg({ trofei });
  const tr = TROFEI.find((x) => x.id === id);
  const n = contaTrofei();
  suona("gol");
  await sovrapposizione(`${coriandoli()}
    <div class="festeggia">
      <div class="coppa-grande">${icona("trofeo", "ico-trofeo")}</div>
      <h2>${esc(tr.nome)}</h2>
      <p>Trofeo in ${esc(t("trofei").toLowerCase())}: ${n} su 3 verso il Triplete.</p>
      <button class="btn grande" data-chiudi>Avanti</button>
    </div>`, { classe: "oro" });
  if (n === 3 && !S.prog.triplete_visto) {
    await mostraTriplete();
    await salvaProg({ triplete_visto: true });
  }
  document.dispatchEvent(new CustomEvent("trofei-aggiornati"));
}

export function mostraTriplete() {
  suona("inno");
  return sovrapposizione(`${coriandoli(80)}
    <div class="festeggia triplete">
      <div class="tre-coppe">${icona("trofeo", "ico-trofeo")}${icona("trofeo", "ico-trofeo")}${icona("trofeo", "ico-trofeo")}</div>
      <h2>Triplete!</h2>
      <p>Coppa Italia, Scudetto e Champions in bacheca. Come nel 2010: qui dentro non ci era mai riuscito nessuno.</p>
      <p class="forte">Buon compleanno, ${esc(nome())}.</p>
      <button class="btn grande" data-chiudi>Festeggia</button>
    </div>`, { classe: "oro" });
}
