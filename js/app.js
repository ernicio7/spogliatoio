import { supabase } from "./supabase.js";
import { S, t, nome, caricaTutto, salvaImp, urlFirmati, urlFirmato, contaTrofei, TROFEI, haTrofeo, aspettoRom } from "./stato.js";
import { icona } from "./glossario.js";
import { impostaSchermo, el, indietro, tornaHome, sovrapposizione } from "./ui.js";
import { APPS, DOCK, registraAzioni, ordineApp } from "./apps.js";
import { Sequenza } from "./sequenza.js";
import { hashSequenza, avviso, esc, messaggioAccesso } from "./comune.js";
import { sbloccaAudio, precaricaSuoni } from "./suoni.js";

const telefono = document.getElementById("telefono");
impostaSchermo(telefono);
let sbloccato = false;

// ---------- Schermate a tutto telefono ----------
function schermata(html) {
  const nodo = el(html);
  telefono.append(nodo);
  return nodo;
}
function rimuovi(nodo, ritardo = 350) {
  nodo.classList.add("esce");
  setTimeout(() => nodo.remove(), ritardo);
}

// ---------- Tema / sfondo ----------
async function applicaTema() {
  const tema = S.imp?.tema || "notte";
  telefono.dataset.sfondo = tema;
  telefono.classList.toggle("rom", aspettoRom());
  telefono.classList.toggle("senza-nav", Array.isArray(S.imp?.widget) && S.imp.widget.includes("nav"));
  if (tema === "foto" && S.imp.sfondo) {
    const u = await urlFirmato(S.imp.sfondo);
    telefono.style.setProperty("--sfondo-foto", `url("${u}")`);
  }
}

// ---------- Ora ----------
function oraCorrente() {
  const d = new Date();
  return {
    ora: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    data: d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }),
    compleanno: d.getDate() === 11 && d.getMonth() === 10,
  };
}
setInterval(() => {
  const { ora, data } = oraCorrente();
  telefono.querySelectorAll("[data-ora]").forEach((n) => { n.textContent = ora; });
  telefono.querySelectorAll("[data-data]").forEach((n) => { n.textContent = data; });
}, 5000);

// ---------- Accesso (configurazione del telefono) ----------
function accesso() {
  const nodo = schermata(`<section class="schermata accesso" aria-label="Configurazione">
    <div class="maglia" aria-hidden="true"></div>
    <div class="accesso-corpo">
      <h1>Benvenuto</h1>
      <p>Configura il telefono: accedi con il tuo account.</p>
      <form novalidate>
        <label for="acc-email">Email</label>
        <input id="acc-email" type="email" autocomplete="username" required>
        <label for="acc-password">Password</label>
        <input id="acc-password" type="password" autocomplete="current-password" required>
        <div class="riga-btn"><button class="btn grande" type="submit">Avanti</button></div>
      </form>
    </div>
  </section>`);
  nodo.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter ?? nodo.querySelector("[type=submit]");
    btn.disabled = true;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: nodo.querySelector("#acc-email").value.trim(),
      password: nodo.querySelector("#acc-password").value,
    });
    btn.disabled = false;
    if (error) return avviso(messaggioAccesso(error), "errore");
    rimuovi(nodo);
    entra(data.user);
  });
}

function nonConvocato() {
  const nodo = schermata(`<section class="schermata accesso" aria-label="Non convocato">
    <div class="maglia" aria-hidden="true"></div>
    <div class="accesso-corpo">
      <h1>Non convocato</h1>
      <p>Questo account non fa parte della rosa del sito.</p>
      <div class="riga-btn"><button class="btn secondario">Esci</button></div>
    </div>
  </section>`);
  nodo.querySelector("button").addEventListener("click", async () => { await supabase.auth.signOut(); location.reload(); });
}

// ---------- Apertura: BUON COMPLEANNO + dump delle foto ----------
// tipo "carosello": foto caricate dalla presidenza (apertura e "Rivedi gli highlights");
// tipo "serata": foto caricate dagli ospiti con il link.
async function apertura({ riproduzione = false, tipo = "carosello" } = {}) {
  const origine = tipo === "serata" ? "ospite" : "owner";
  const foto = (await supabase.from("foto").select("percorso").eq("origine", origine).order("creato_il")).data ?? [];
  if (riproduzione && !foto.length) {
    avviso(tipo === "serata" ? "Ancora nessuna foto della serata." : "Ancora nessuna foto nel carosello.");
    return;
  }
  const urls = await urlFirmati(foto.map((f) => f.percorso));
  return new Promise((risolvi) => {
    const nodo = schermata(`<section class="schermata festa" aria-label="Buon compleanno">
      <div class="festa-titolo">${imgStemma("festa-stemma")}<span>${tipo === "serata" ? "La serata di" : "Buon compleanno"}</span><strong>${esc(nome().toUpperCase())}</strong></div>
      <div class="tavolo" aria-hidden="true"></div>
      <p class="festa-contatore" aria-live="polite"></p>
      <button class="btn-salta">Salta</button>
    </section>`);
    let finito = false;
    const fine = async () => {
      if (finito) return;
      finito = true;
      if (!riproduzione) await salvaImp({ apertura_vista: true });
      rimuovi(nodo, 700);
      setTimeout(risolvi, 700);
    };
    nodo.querySelector(".btn-salta").addEventListener("click", fine);
    const n = foto.length;
    const ridotto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const passo = n ? Math.min(2600, Math.max(900, 70000 / n)) : 0;
    const precarica = (i) => { if (i < n) { const im = new Image(); im.src = urls.get(foto[i].percorso); } };
    for (let k = 0; k < 4; k++) precarica(k);
    const tavolo = nodo.querySelector(".tavolo");
    let i = 0;
    const prossima = () => {
      if (finito) return;
      if (i >= n) { setTimeout(fine, 2200); return; }
      precarica(i + 4);
      const st = document.createElement("figure");
      st.className = "stampa";
      st.style.setProperty("--r", `${ridotto ? 0 : (Math.random() * 16 - 8).toFixed(1)}deg`);
      st.style.setProperty("--x", `${ridotto ? 0 : (Math.random() * 20 - 10).toFixed(1)}%`);
      st.style.setProperty("--y", `${ridotto ? 0 : (Math.random() * 14 - 7).toFixed(1)}%`);
      st.innerHTML = `<img alt="" src="${esc(urls.get(foto[i].percorso))}">`;
      tavolo.append(st);
      const pila = tavolo.querySelectorAll(".stampa");
      if (pila.length > 10) pila[0].remove();
      nodo.querySelector(".festa-contatore").textContent = `${t("highlights")}: ${i + 1} di ${n}`;
      i++;
      setTimeout(prossima, passo);
    };
    setTimeout(() => nodo.classList.add("titolo-su"), n ? 3000 : 99999);
    if (n) setTimeout(prossima, 3600);
    else setTimeout(fine, 4500);
  });
}

// ---------- Sblocco recente nella stessa scheda (es. ritorno dalla presidenza) ----------
const chiaveSblocco = () => `sbloccato-${S.utente?.id}`;
function segnaSblocco() {
  try { sessionStorage.setItem(chiaveSblocco(), String(Date.now())); } catch { /* niente */ }
}
function sbloccoRecente() {
  try {
    const t = Number(sessionStorage.getItem(chiaveSblocco()));
    return !!t && Date.now() - t < 5 * 60 * 1000;
  } catch { return false; }
}
window.addEventListener("pagehide", () => { if (sbloccato && S.utente) segnaSblocco(); });

// ---------- Schermata di blocco (tornelli) ----------
async function nuoveFoto() {
  const visto = localStorage.getItem(`album-visto-${S.utente.id}`);
  if (!visto) return 0;
  const { count } = await supabase.from("foto").select("id", { count: "exact", head: true }).eq("origine", "ospite").gt("creato_il", visto);
  return count ?? 0;
}

function bloccoSchermo() {
  sbloccato = false;
  return new Promise((risolvi) => {
    const { ora, data } = oraCorrente();
    const nodo = schermata(`<section class="schermata blocco" aria-label="${esc(t("blocco"))}">
      <div class="blocco-ora">${imgStemma("stemma-blocco")}<div class="ora-grande" data-ora>${esc(ora)}</div><div class="data-blocco" data-data>${esc(data)}</div><div class="marchio-rom">Nerazzurro OS</div></div>
      <div class="blocco-notifiche"></div>
      <div class="blocco-sequenza">
        <p class="etichetta-blocco">${icona("lucchetto")} ${esc(t("blocco"))}</p>
        <p class="istruzione" aria-live="polite"></p>
        <div class="contenitore-seq"></div>
        <button class="link-piccolo" data-password>Usa la password</button>
      </div>
    </section>`);
    nuoveFoto().then((n) => {
      if (n) nodo.querySelector(".blocco-notifiche").append(el(`<div class="notifica">${icona("album")}<span><strong>${esc(t("notifica"))}</strong>${n} ${n === 1 ? "nuova foto della serata" : "nuove foto della serata"} nell'${esc(t("album").toLowerCase())}</span></div>`));
    });
    const istr = nodo.querySelector(".istruzione");
    let impostare = !S.imp.sequenza_hash;
    let prima = null;
    let tentativi = 0;
    let fermoFino = 0;
    const testoBase = () => (impostare ? "Imposta il tuo biglietto: disegna una sequenza di almeno 4 punti." : t("disegna"));
    istr.textContent = testoBase();

    const sblocca = () => {
      sbloccato = true;
      segnaSblocco();
      rimuovi(nodo, 400);
      setTimeout(risolvi, 250);
    };
    const seq = new Sequenza(nodo.querySelector(".contenitore-seq"), {
      etichetta: t("disegna"),
      onFine: async (s) => {
        if (Date.now() < fermoFino) { seq.errore(); return; }
        if (impostare) {
          if (s.length < 4) { seq.errore(); istr.textContent = "Servono almeno 4 punti."; return; }
          if (!prima) { prima = s; istr.textContent = "Ridisegnala per conferma."; setTimeout(() => seq.reset(), 350); return; }
          if (prima.join("-") !== s.join("-")) { prima = null; seq.errore(); istr.textContent = "Non coincide. Ricomincia."; return; }
          await salvaImp({ sequenza_hash: await hashSequenza(S.utente.id, s) });
          seq.ok();
          setTimeout(sblocca, 300);
          return;
        }
        const h = await hashSequenza(S.utente.id, s);
        if (h === S.imp.sequenza_hash) { seq.ok(); setTimeout(sblocca, 250); return; }
        seq.errore();
        if (++tentativi >= 5) {
          tentativi = 0;
          fermoFino = Date.now() + 30000;
          istr.textContent = "Troppi tentativi. Riprova tra 30 secondi.";
          setTimeout(() => { istr.textContent = testoBase(); }, 30000);
        } else {
          istr.textContent = "Sequenza errata. Riprova.";
        }
      },
    });

    nodo.querySelector("[data-password]").addEventListener("click", () => {
      const f = el(`<form class="riga-risposta" novalidate>
        <label for="blocco-pw" class="nascosto-vista">Password</label>
        <input id="blocco-pw" type="password" autocomplete="current-password" placeholder="Password">
        <button class="btn" type="submit">Sblocca</button></form>`);
      nodo.querySelector("[data-password]").replaceWith(f);
      f.querySelector("input").focus();
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email: S.utente.email, password: f.querySelector("input").value });
        if (error) return avviso(messaggioAccesso(error), "errore");
        impostare = true;
        prima = null;
        f.remove();
        seq.reset();
        istr.textContent = "Password corretta. Disegna una nuova sequenza di almeno 4 punti.";
      });
    });
  });
}

// ---------- Benvenuto ----------
async function benvenuto() {
  await sovrapposizione(`<div class="benvenuto">
    <div class="maglia" aria-hidden="true"></div>
    <h2>Benvenuto nel tuo sito, ${esc(nome())}</h2>
    <p>Da qualche parte, qui dentro, ti aspettano alcune sfide. Completale e porta a casa i trofei: vincili tutti e il Triplete è tuo.</p>
    <p>Se i termini da bordocampo ti confondono, nello ${esc(S.imp.nomenclatura === "originale" ? "Impostazioni" : "Spogliatoio")} puoi tornare ai nomi di sempre.</p>
    <p>Per goderti tutto al meglio, alza il volume.</p>
    <p>Il Mister ha l'agenda piena: le sue risposte giornaliere sono contate, quindi pesa bene le domande.</p>
    <p class="forte">Questo sito è tuo, divertiti a personalizzarlo.</p>
    <button class="btn grande" data-chiudi>${esc(t("inizia"))}</button>
  </div>`);
}

// ---------- Riavvio con Nerazzurro OS ----------
async function riavvio() {
  tornaHome();
  await new Promise((r) => setTimeout(r, 300));
  await new Promise((risolvi) => {
    const nodo = schermata(`<section class="schermata avvio-rom" aria-label="Riavvio">
      ${imgStemma("rom-stemma")}
      <div class="rom-logo"><span>Nerazzurro</span><strong>OS</strong></div>
      <div class="rom-stelle" aria-hidden="true">${"★".repeat(2)}</div>
      <div class="progresso"><i></i></div>
      <p>Versione 31</p>
    </section>`);
    requestAnimationFrame(() => nodo.classList.add("parte"));
    setTimeout(() => { rimuovi(nodo, 600); setTimeout(risolvi, 600); }, 4200);
  });
  await applicaTema();
  costruisciHome();
  await bloccoSchermo();
}

// ---------- Home ----------
function iconaApp(app) {
  const stemma = app.id === "diario" && S.stemmaUrl;
  const b = el(`<button class="app" data-app="${app.id}">
    <span class="app-tile tile-${app.id}${stemma ? " tile-stemma" : ""}">${stemma ? imgStemma("") : icona(app.icona)}</span>
    <span class="app-nome">${esc(app.nome())}</span>
  </button>`);
  b.addEventListener("click", app.apri);
  return b;
}

async function rinfrescaHome() {
  const home = telefono.querySelector(".home");
  if (!home) return;
  await aggiornaStemma();
  const disattivi = Array.isArray(S.imp.widget) ? S.imp.widget : [];
  const w = home.querySelector(".widgets");
  w.innerHTML = "";
  const { ora, data, compleanno } = oraCorrente();
  if (!disattivi.includes("orologio")) {
    w.append(el(`<div class="widget orologio">
      <div class="ora-widget" data-ora>${esc(ora)}</div>
      <div class="data-widget" data-data>${esc(data)}</div>
      <p class="saluto">${compleanno ? `Buon compleanno, ${esc(nome())}` : "Forza Inter"}</p>
    </div>`));
  }
  if (!disattivi.includes("comunicati")) {
    const n = await nuoveFoto();
    if (n) {
      const c = el(`<button class="widget comunicato">${icona("album")}<span><strong>${esc(t("notifica"))}</strong>${n} ${n === 1 ? "nuova foto della serata" : "nuove foto della serata"} nell'${esc(t("album").toLowerCase())}</span></button>`);
      c.addEventListener("click", () => DOCK.find((a) => a.id === "album").apri());
      w.append(c);
    }
  }
  if (!disattivi.includes("bacheca")) {
    const b = el(`<button class="widget bacheca-widget" aria-label="${esc(t("trofei"))}">
      <span class="coppe">${TROFEI.map((x) => `<span class="${haTrofeo(x.id) ? "vinto" : ""}" title="${esc(x.nome)}">${icona("trofeo")}</span>`).join("")}</span>
      <span><strong>${contaTrofei()} su 3</strong> verso il Triplete</span>
    </button>`);
    b.addEventListener("click", () => DOCK.find((a) => a.id === "bacheca").apri());
    w.append(b);
  }
  const griglia = home.querySelector(".griglia-app");
  griglia.innerHTML = "";
  for (const id of ordineApp()) griglia.append(iconaApp(APPS.find((a) => a.id === id)));
  const dock = home.querySelector(".dock");
  dock.innerHTML = "";
  for (const app of DOCK) dock.append(iconaApp(app));
}

function costruisciHome() {
  telefono.querySelector(".home")?.remove();
  telefono.querySelector(".barra-stato")?.remove();
  telefono.querySelector(".barra-nav")?.remove();
  telefono.append(el(`<div class="barra-stato" aria-hidden="true">
    <span data-ora>${esc(oraCorrente().ora)}</span>
    <span class="icone-stato"><span class="fascia" title="Fascia da capitano">C</span>${icona("tifo", "ico-stato")}${icona("fiato", "ico-stato")}</span>
  </div>`));
  telefono.append(el(`<main class="home" aria-label="${esc(t("home"))}">
    <div class="home-scorre"><div class="widgets"></div><div class="griglia-app"></div></div>
    <div class="dock"></div>
  </main>`));
  const nav = el(`<nav class="barra-nav" aria-label="Navigazione">
    <button data-nav="indietro" aria-label="Indietro">${icona("indietro")}</button>
    <button data-nav="home" aria-label="${esc(t("home"))}">${icona("casa")}</button>
  </nav>`);
  nav.querySelector('[data-nav="indietro"]').addEventListener("click", indietro);
  nav.querySelector('[data-nav="home"]').addEventListener("click", tornaHome);
  telefono.append(nav);
  rinfrescaHome();
}

document.addEventListener("trofei-aggiornati", rinfrescaHome);
for (const evento of ["pointerdown", "touchend", "keydown"]) {
  document.addEventListener(evento, sbloccaAudio, { capture: true, passive: true });
}
document.addEventListener("album-visto", rinfrescaHome);

// ---------- Tastiera aperta: la barra in basso sparisce e il campo resta visibile ----------
const touch = matchMedia("(pointer: coarse)").matches;
const eCampo = (n) => n?.matches?.("input:not([type=checkbox]):not([type=file]):not([type=radio]), textarea, select");
telefono.addEventListener("focusin", (e) => {
  if (!touch || !eCampo(e.target)) return;
  telefono.classList.add("tastiera");
  setTimeout(() => e.target.scrollIntoView?.({ block: "center", behavior: "smooth" }), 350);
});
telefono.addEventListener("focusout", () => {
  setTimeout(() => { if (!eCampo(document.activeElement)) telefono.classList.remove("tastiera"); }, 120);
});

// ---------- Blocco automatico dopo 5 minuti in background ----------
let nascostoDa = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { nascostoDa = Date.now(); return; }
  if (sbloccato && S.imp && nascostoDa && Date.now() - nascostoDa > 5 * 60 * 1000) {
    tornaHome();
    bloccoSchermo().then(rinfrescaHome);
  }
});

// ---------- Flusso principale ----------
async function aggiornaStemma() {
  S.stemmaUrl = S.config.stemma ? await urlFirmato(S.config.stemma) : "";
}
const imgStemma = (classe) => (S.stemmaUrl ? `<img class="${classe}" alt="" src="${esc(S.stemmaUrl)}" onerror="this.remove()">` : "");

async function entra(utente) {
  S.utente = utente;
  let ok = false;
  try { ok = await caricaTutto(); } catch { ok = false; }
  telefono.querySelector(".caricamento")?.remove();
  if (!ok) return nonConvocato();
  await aggiornaStemma();
  precaricaSuoni();
  await applicaTema();
  costruisciHome();
  const primaVolta = !S.imp.apertura_vista;
  if (primaVolta) await apertura();
  if (!primaVolta && S.imp.sequenza_hash && sbloccoRecente()) {
    sbloccato = true;
    segnaSblocco();
  } else {
    await bloccoSchermo();
  }
  if (!S.imp.benvenuto_visto) {
    await benvenuto();
    await salvaImp({ benvenuto_visto: true });
  }
}

registraAzioni({
  rinfrescaHome: () => { costruisciHome(); },
  applicaTema,
  apertura,
  benvenuto,
  riavvio,
});

async function avvio() {
  schermata(`<section class="schermata caricamento" aria-label="Caricamento"><div class="maglia"></div><p>Riscaldamento…</p></section>`);
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    telefono.querySelector(".caricamento")?.remove();
    return accesso();
  }
  entra(data.session.user);
}

console.log("%cSei al VAR.%c\nDa qui puoi rivedere tutto. Buona moviola.",
  "font: 700 28px sans-serif; color: #1a5fd0", "font: 14px sans-serif");

avvio();
