import { icona } from "./glossario.js";
import { S, t, salvaProg, TROFEI, contaTrofei, nome, urlFirmato } from "./stato.js";
import { esc } from "./comune.js";

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
// campi: { id, etichetta, tipo: testo|numero|data|area|scelta|foto|spunta|password, opzioni, valore, aiuto }
export function modulo({ titolo, campi, salva, elimina = null, testoSalva = "Salva" }) {
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
    const val = c.valore ?? "";
    let html;
    if (c.tipo === "area") html = `<textarea id="${id}" rows="3">${esc(val)}</textarea>`;
    else if (c.tipo === "scelta") html = `<select id="${id}">${c.opzioni.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    else if (c.tipo === "spunta") html = `<label class="spunta"><input id="${id}" type="checkbox" ${val ? "checked" : ""}> ${esc(c.testoSpunta ?? "")}</label>`;
    else if (c.tipo === "foto") html = `<div class="campo-foto"><img alt="" class="${val ? "" : "nascosto"}"><input id="${id}" type="file" accept="image/*" class="file-nascosto"><label for="${id}" class="btn secondario">${icona("camera")} ${val ? "Cambia foto" : "Aggiungi foto"}</label></div>`;
    else {
      const tipo = { numero: "number", data: "date", password: "password" }[c.tipo] ?? "text";
      html = `<input id="${id}" type="${tipo}" value="${esc(val)}" autocomplete="off" ${c.tipo === "numero" ? 'inputmode="numeric"' : ""}>`;
    }
    const blocco = el(`<div class="campo">${c.tipo === "spunta" ? "" : `<label for="${id}">${esc(c.etichetta)}</label>`}${html}${c.aiuto ? `<p class="aiuto">${esc(c.aiuto)}</p>` : ""}</div>`);
    contenitore.appendChild(blocco);
    if (c.tipo === "foto") {
      const img = blocco.querySelector("img");
      if (val) urlFirmato(val).then((u) => { img.src = u; });
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
    for (const c of campi) {
      const input = nodo.querySelector(`#campo-${c.id}`);
      if (c.tipo === "spunta") valori[c.id] = input.checked;
      else if (c.tipo === "foto") valori[c.id] = fileScelti[c.id] ? { file: fileScelti[c.id] } : (c.valore ?? null);
      else if (c.tipo === "numero") valori[c.id] = input.value === "" ? null : Number(input.value);
      else valori[c.id] = input.value.trim();
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
  return sovrapposizione(`${coriandoli(80)}
    <div class="festeggia triplete">
      <div class="tre-coppe">${icona("trofeo", "ico-trofeo")}${icona("trofeo", "ico-trofeo")}${icona("trofeo", "ico-trofeo")}</div>
      <h2>Triplete!</h2>
      <p>Coppa Italia, Scudetto e Champions in bacheca. Come nel 2010: qui dentro non ci era mai riuscito nessuno.</p>
      <p class="forte">Buon compleanno, ${esc(nome())}.</p>
      <button class="btn grande" data-chiudi>Festeggia</button>
    </div>`, { classe: "oro" });
}
