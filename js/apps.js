import { supabase, chiamaFunzione } from "./supabase.js";
import { S, t, nome, eOwner, salvaImp, salvaProg, urlFirmati, urlFirmato, caricaFile, TROFEI, haTrofeo, contaTrofei } from "./stato.js";
import { icona, statoDispositivo, STATI_DISPOSITIVO, AVATAR_MISTER } from "./glossario.js";
import { pannello, modulo, el, assegnaTrofeo, mostraTriplete, indietro, getSchermo } from "./ui.js";
import { esc, avviso, hashSequenza } from "./comune.js";
import { Sequenza } from "./sequenza.js";

// Collegamenti verso app.js (registrati all'avvio, per evitare import circolari)
const azioni = {};
export const registraAzioni = (a) => Object.assign(azioni, a);

export const APPS = [
  { id: "garage", nome: () => "Garage", icona: "auto", apri: apriGarage },
  { id: "ludoteca", nome: () => "Ludoteca", icona: "dado", apri: apriLudoteca },
  { id: "tecnologia", nome: () => "Tecnologia", icona: "chip", apri: apriTecnologia },
  { id: "diario", nome: () => "Diario partite", icona: "pallone", apri: apriDiario },
  { id: "presidenza", nome: () => t("presidenza"), icona: "valigetta", apri: () => { location.href = "presidenza/"; }, soloOwner: true },
];
export const DOCK = [
  { id: "album", nome: () => t("album"), icona: "album", apri: apriAlbum },
  { id: "mister", nome: () => t("guardiano"), icona: "fischietto", apri: apriMister },
  { id: "bacheca", nome: () => t("trofei"), icona: "trofeo", apri: apriBacheca },
  { id: "spogliatoio", nome: () => t("impostazioni"), icona: "regolazioni", apri: apriSpogliatoio },
];

// ---------- Utilità ----------
const dataIt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "");
const normalizza = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, "");

function bottoneAggiungi(p, etichetta, azione) {
  p.azioni.innerHTML = `<button class="btn-icona" aria-label="${esc(etichetta)}">${icona("piu")}</button>`;
  p.azioni.firstElementChild.addEventListener("click", azione);
}

async function fotoDaValore(v, cartella) {
  if (v && typeof v === "object" && v.file) {
    const percorso = await caricaFile(v.file, cartella);
    if (!percorso) avviso("Foto non caricata. Riprova.", "errore");
    return percorso;
  }
  return v ?? null;
}

function schedaElemento({ titolo, sotto = "", testo = "", foto = "", iconaVuota = "camera", chip = "" }) {
  return el(`<article class="scheda scheda-elemento">
    <div class="miniatura ${foto ? "" : "vuota"}">${foto ? `<img alt="" loading="lazy" src="${esc(foto)}">` : icona(iconaVuota)}</div>
    <div class="testo-scheda">
      <h3>${esc(titolo)}</h3>
      ${sotto ? `<p class="sotto">${esc(sotto)}</p>` : ""}
      ${chip ? `<span class="chip">${esc(chip)}</span>` : ""}
      ${testo ? `<p class="note">${esc(testo)}</p>` : ""}
    </div>
    <button class="btn-icona piccolo" aria-label="Modifica ${esc(titolo)}">${icona("matita")}</button>
  </article>`);
}

function vuoto(testo) {
  return el(`<p class="vuoto">${esc(testo)}</p>`);
}

// =====================================================================
// GARAGE: indovinello per la Coppa Italia
// =====================================================================
const INDOVINELLO = [
  "Se mi perdi sei fregato,",
  "resti a piedi e sconsolato.",
  "Mi cerchi sempre più lontano,",
  "ma sono qui, a portata di mano.",
  "Cosa sono?",
];

function verificaRisposta(r) {
  const s = String(r).toLowerCase().replace(/[\s_.\-'"]/g, "");
  if (/^lanciabetake+y+s*$/.test(s)) return "giusta";
  if (/chiav|key|kei|lancia|beta/.test(s)) return "quasi";
  return "sbagliata";
}

function sfidaGarage(ridisegna) {
  if (haTrofeo("coppa")) {
    return el(`<div class="sfida vinta">${icona("trofeo")}<div><strong>Coppa Italia vinta.</strong><p>La Spider ha il motore acceso.</p></div></div>`);
  }
  const indizioVisto = !!S.prog.indizi?.coppa;
  const nodo = el(`<div class="quadro" aria-label="Sfida Coppa Italia">
    <div class="quadro-strumenti" aria-hidden="true">
      <div class="lancetta-box"><div class="lancetta"></div><span>giri</span></div>
      <div class="spie"><i></i><i></i><i></i></div>
      <div class="lancetta-box"><div class="lancetta"></div><span>km/h</span></div>
    </div>
    <p class="quadro-titolo">Sfida Coppa Italia: il quadro è spento. Per accendere la Spider, rispondi.</p>
    <blockquote class="indovinello">${INDOVINELLO.map(esc).join("<br>")}</blockquote>
    <form class="riga-risposta" novalidate>
      <label for="risposta-garage" class="nascosto-vista">Risposta</label>
      <input id="risposta-garage" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="La tua risposta">
      <button class="btn" type="submit">Avvia</button>
    </form>
    <p class="esito-risposta" aria-live="polite"></p>
    <button type="button" class="link-indizio">${indizioVisto ? "Indizio: matrimonio" : `Mostra l'indizio (${esc(t("indizi").toLowerCase())})`}</button>
  </div>`);
  nodo.querySelector(".link-indizio").addEventListener("click", async (e) => {
    e.target.textContent = "Indizio: matrimonio";
    if (!S.prog.indizi?.coppa) await salvaProg({ indizi: { ...S.prog.indizi, coppa: 1 } });
  });
  nodo.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = nodo.querySelector("input");
    const esito = nodo.querySelector(".esito-risposta");
    const r = verificaRisposta(input.value);
    if (r === "giusta") {
      esito.textContent = "Contatto!";
      nodo.classList.add("acceso");
      input.disabled = true;
      setTimeout(async () => { await assegnaTrofeo("coppa"); ridisegna(); }, 1900);
    } else if (r === "quasi") {
      esito.textContent = "Ci sei quasi, ma non si scrive così.";
    } else {
      esito.textContent = "Il motore non parte. Riprova.";
      nodo.classList.remove("scossa");
      void nodo.offsetWidth;
      nodo.classList.add("scossa");
    }
  });
  return nodo;
}

async function apriGarage() {
  const p = pannello("Garage");
  const disegna = async () => {
    const auto = (await supabase.from("auto").select("*").order("creato_il")).data ?? [];
    const urls = await urlFirmati(auto.map((a) => a.foto).filter(Boolean));
    p.corpo.innerHTML = "";
    p.corpo.append(sfidaGarage(disegna));
    p.corpo.append(el(`<h3 class="sottotitolo">Le auto</h3>`));
    if (!auto.length) p.corpo.append(vuoto("Il garage è vuoto. Aggiungi la prima auto con il +."));
    for (const a of auto) {
      const s = schedaElemento({
        titolo: a.nome,
        sotto: [a.anno, a.colore].filter(Boolean).join(", "),
        testo: a.note ?? "",
        foto: urls.get(a.foto) ?? "",
        iconaVuota: "auto",
      });
      s.querySelector("button").addEventListener("click", () => moduloAuto(a, disegna));
      p.corpo.append(s);
    }
  };
  bottoneAggiungi(p, "Aggiungi un'auto", () => moduloAuto(null, disegna));
  disegna();
}

function moduloAuto(a, poi) {
  modulo({
    titolo: a ? "Modifica auto" : "Nuova auto",
    campi: [
      { id: "nome", etichetta: "Modello", valore: a?.nome },
      { id: "anno", etichetta: "Anno", tipo: "numero", valore: a?.anno },
      { id: "colore", etichetta: "Colore", valore: a?.colore },
      { id: "note", etichetta: "Note e ricordi", tipo: "area", valore: a?.note },
      { id: "foto", etichetta: "Foto", tipo: "foto", valore: a?.foto },
    ],
    salva: async (v) => {
      if (!v.nome) { avviso("Scrivi almeno il modello.", "errore"); return false; }
      v.foto = await fotoDaValore(v.foto, "contenuti");
      const q = a ? supabase.from("auto").update(v).eq("id", a.id) : supabase.from("auto").insert(v);
      const { error } = await q;
      if (error) { avviso("Salvataggio non riuscito.", "errore"); return false; }
      poi();
    },
    elimina: a ? async () => { await supabase.from("auto").delete().eq("id", a.id); poi(); } : null,
  });
}

// =====================================================================
// LUDOTECA: collezione, Scudetto al primo gioco aggiunto
// =====================================================================
async function apriLudoteca() {
  const p = pannello("Ludoteca");
  const disegna = async () => {
    const giochi = (await supabase.from("giochi").select("*").order("nome")).data ?? [];
    const urls = await urlFirmati(giochi.map((g) => g.foto).filter(Boolean));
    p.corpo.innerHTML = "";
    if (!haTrofeo("scudetto")) {
      const sfida = el(`<div class="sfida">${icona("trofeo")}<div><strong>Sfida Scudetto</strong><p>Aggiungi alla collezione il tuo primo gioco.</p><button class="btn">Aggiungi un gioco</button></div></div>`);
      sfida.querySelector("button").addEventListener("click", () => moduloGioco(null, disegna));
      p.corpo.append(sfida);
    } else {
      p.corpo.append(el(`<div class="sfida vinta">${icona("trofeo")}<div><strong>Scudetto vinto.</strong><p>La collezione è ufficialmente tua.</p></div></div>`));
    }
    p.corpo.append(el(`<h3 class="sottotitolo">La collezione: ${giochi.length} ${giochi.length === 1 ? "gioco" : "giochi"}</h3>`));
    for (const g of giochi) {
      const s = schedaElemento({ titolo: g.nome, testo: g.note ?? "", foto: urls.get(g.foto) ?? "", iconaVuota: "dado" });
      s.querySelector("button").addEventListener("click", () => moduloGioco(g, disegna));
      p.corpo.append(s);
    }
  };
  bottoneAggiungi(p, "Aggiungi un gioco", () => moduloGioco(null, disegna));
  disegna();
}

function moduloGioco(g, poi) {
  modulo({
    titolo: g ? "Modifica gioco" : "Nuovo gioco",
    campi: [
      { id: "nome", etichetta: "Nome del gioco", valore: g?.nome },
      { id: "note", etichetta: "Note", tipo: "area", valore: g?.note },
      { id: "foto", etichetta: "Foto della scatola", tipo: "foto", valore: g?.foto },
    ],
    salva: async (v) => {
      if (!v.nome) { avviso("Scrivi il nome del gioco.", "errore"); return false; }
      v.foto = await fotoDaValore(v.foto, "contenuti");
      const { error } = g
        ? await supabase.from("giochi").update(v).eq("id", g.id)
        : await supabase.from("giochi").insert(v);
      if (error) { avviso("Salvataggio non riuscito.", "errore"); return false; }
      if (!g && !haTrofeo("scudetto")) setTimeout(() => assegnaTrofeo("scudetto").then(poi), 350);
      else poi();
    },
    elimina: g ? async () => { await supabase.from("giochi").delete().eq("id", g.id); poi(); } : null,
  });
}

// =====================================================================
// TECNOLOGIA: PC, smartphone, confronto, sfida Champions con indizi
// =====================================================================
const SPECIFICHE = {
  pc: [["processore", "Processore"], ["ram", "RAM"], ["memoria", "Memoria"], ["scheda_video", "Scheda video"], ["schermo", "Schermo"], ["sistema", "Sistema operativo"]],
  smartphone: [["processore", "Processore"], ["ram", "RAM"], ["memoria", "Memoria"], ["schermo", "Schermo"], ["batteria", "Batteria"], ["fotocamera", "Fotocamera"], ["sistema", "Sistema operativo"]],
};

function indiziChampions() {
  const calcio = S.imp.nomenclatura !== "originale";
  return [
    `Ogni smanettone Android sa da dove si parte: ${calcio ? "Spogliatoio (Impostazioni)" : "Impostazioni"}, poi Info telefono.`,
    `C'è un numero che, se insisti, ti fa entrare nello ${calcio ? "staff tecnico" : "sviluppo"}. Prova a toccare più volte "Numero build".`,
    `Ora sei in ${calcio ? "Area tecnica (Opzioni sviluppatore)" : "Opzioni sviluppatore"}. Cerca l'interruttore che un telefono normale non ti farebbe mai toccare.`,
    `Il bootloader è ${t("bootloader_bloccato").toLowerCase()}: per sbloccarlo serve la ${t("clausola").toLowerCase()}. Chi ce l'ha? ${t("guardiano")}. Vai a parlargli.`,
    `${t("guardiano")} non regala niente: dimostragli di essere un vero interista, oppure provocalo. Le sfide verbali gli piacciono.`,
    `Va bene, te la diamo noi: la ${t("clausola").toLowerCase()} è ${S.config.clausola ?? "(non impostata)"}. Ora ${calcio ? "cambia modulo e installa" : "installa"} la ROM.`,
  ];
}

function sfidaChampions() {
  if (haTrofeo("champions")) {
    return el(`<div class="sfida vinta">${icona("trofeo")}<div><strong>Champions vinta.</strong><p>Telefono libero, ROM nerazzurra installata.</p></div></div>`);
  }
  const nodo = el(`<div class="sfida">${icona("trofeo")}<div>
    <strong>Sfida Champions</strong>
    <p>Il tuo telefono è sotto contratto con la vecchia società. Liberalo e porta a casa la Champions.</p>
    <ol class="indizi"></ol>
    <button class="btn secondario">${icona("aiuto")} ${esc(t("indizi"))}: mostra un indizio</button>
  </div></div>`);
  const lista = nodo.querySelector(".indizi");
  const btn = nodo.querySelector("button");
  const tutti = indiziChampions();
  const mostra = () => {
    const n = S.prog.indizi?.champions ?? 0;
    lista.innerHTML = tutti.slice(0, n).map((x) => `<li>${esc(x)}</li>`).join("");
    btn.classList.toggle("nascosto", n >= tutti.length);
    btn.lastChild.textContent = ` ${t("indizi")}: indizio ${n + 1} di ${tutti.length}`;
  };
  btn.addEventListener("click", async () => {
    const n = Math.min((S.prog.indizi?.champions ?? 0) + 1, tutti.length);
    await salvaProg({ indizi: { ...S.prog.indizi, champions: n } });
    mostra();
  });
  mostra();
  return nodo;
}

async function apriTecnologia() {
  const p = pannello("Tecnologia");
  let scheda = "smartphone";
  const disegna = async () => {
    const disp = (await supabase.from("dispositivi").select("*").order("creato_il")).data ?? [];
    const urls = await urlFirmati(disp.map((d) => d.foto).filter(Boolean));
    p.corpo.innerHTML = "";
    p.corpo.append(sfidaChampions());
    const tabs = el(`<div class="segmentato" role="tablist">
      <button role="tab" data-s="smartphone">Smartphone</button>
      <button role="tab" data-s="pc">PC</button>
      <button role="tab" data-s="confronto">${icona("colonne")} Confronto</button>
    </div>`);
    tabs.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.s === scheda));
      b.addEventListener("click", () => { scheda = b.dataset.s; disegna(); });
    });
    p.corpo.append(tabs);
    if (scheda === "confronto") return p.corpo.append(confronto(disp));
    const elenco = disp.filter((d) => d.tipo === scheda);
    if (!elenco.length) p.corpo.append(vuoto(`Nessun ${scheda === "pc" ? "PC" : "telefono"} ancora. Aggiungilo con il +.`));
    for (const d of elenco) {
      const periodo = [d.dal, d.al].filter(Boolean).join(" – ");
      const s = schedaElemento({
        titolo: [d.marca, d.modello].filter(Boolean).join(" "),
        sotto: periodo,
        chip: statoDispositivo(d.stato, S.imp.nomenclatura) + (d.nota_stato ? `: ${d.nota_stato}` : ""),
        testo: d.modifiche ? `Modifiche: ${d.modifiche}` : "",
        foto: urls.get(d.foto) ?? "",
        iconaVuota: scheda === "pc" ? "chip" : "telefono",
      });
      s.querySelector("button").addEventListener("click", () => moduloDispositivo(d, d.tipo, disegna));
      p.corpo.append(s);
    }
  };
  bottoneAggiungi(p, "Aggiungi un dispositivo", () => moduloDispositivo(null, scheda === "pc" ? "pc" : "smartphone", disegna));
  disegna();
}

function moduloDispositivo(d, tipo, poi) {
  const sp = d?.specifiche ?? {};
  modulo({
    titolo: d ? "Modifica dispositivo" : (tipo === "pc" ? "Nuovo PC" : "Nuovo smartphone"),
    campi: [
      { id: "marca", etichetta: "Marca", valore: d?.marca },
      { id: "modello", etichetta: "Modello", valore: d?.modello },
      { id: "dal", etichetta: "Usato dal", valore: d?.dal, aiuto: "Anche solo l'anno." },
      { id: "al", etichetta: "Fino al", valore: d?.al },
      { id: "stato", etichetta: "Stato attuale", tipo: "scelta", valore: d?.stato ?? "in_uso",
        opzioni: Object.keys(STATI_DISPOSITIVO).map((k) => [k, statoDispositivo(k, S.imp.nomenclatura)]) },
      { id: "nota_stato", etichetta: "Cosa fa adesso", valore: d?.nota_stato, aiuto: "Per esempio: ora è una telecamera di sicurezza." },
      { id: "modifiche", etichetta: "Modifiche fatte", tipo: "area", valore: d?.modifiche, aiuto: "Root, ROM, batteria cambiata, RAM aggiunta…" },
      ...SPECIFICHE[tipo].map(([k, l]) => ({ id: `sp_${k}`, etichetta: l, valore: sp[k] })),
      { id: "foto", etichetta: "Foto", tipo: "foto", valore: d?.foto },
    ],
    salva: async (v) => {
      if (!v.modello) { avviso("Scrivi almeno il modello.", "errore"); return false; }
      const specifiche = {};
      for (const [k] of SPECIFICHE[tipo]) { if (v[`sp_${k}`]) specifiche[k] = v[`sp_${k}`]; delete v[`sp_${k}`]; }
      v.specifiche = specifiche;
      v.tipo = tipo;
      v.foto = await fotoDaValore(v.foto, "contenuti");
      const { error } = d
        ? await supabase.from("dispositivi").update(v).eq("id", d.id)
        : await supabase.from("dispositivi").insert(v);
      if (error) { avviso("Salvataggio non riuscito.", "errore"); return false; }
      poi();
    },
    elimina: d ? async () => { await supabase.from("dispositivi").delete().eq("id", d.id); poi(); } : null,
  });
}

function confronto(disp) {
  let tipo = "smartphone";
  const scelti = new Set();
  const nodo = el(`<div class="confronto">
    <div class="segmentato piccolo"><button data-t="smartphone">Smartphone</button><button data-t="pc">PC</button></div>
    <p class="aiuto">Scegli fino a 3 dispositivi.</p>
    <div class="scelte"></div>
    <div class="tabella-scorre"></div>
  </div>`);
  const disegna = () => {
    nodo.querySelectorAll("[data-t]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.t === tipo)));
    const elenco = disp.filter((d) => d.tipo === tipo);
    nodo.querySelector(".scelte").innerHTML = elenco.length
      ? elenco.map((d) => `<label class="spunta"><input type="checkbox" value="${d.id}" ${scelti.has(d.id) ? "checked" : ""}> ${esc([d.marca, d.modello].filter(Boolean).join(" "))}</label>`).join("")
      : `<p class="vuoto">Nessun dispositivo di questo tipo.</p>`;
    nodo.querySelectorAll(".scelte input").forEach((c) => c.addEventListener("change", () => {
      if (c.checked && scelti.size >= 3) { c.checked = false; avviso("Massimo 3 dispositivi."); return; }
      c.checked ? scelti.add(c.value) : scelti.delete(c.value);
      disegna();
    }));
    const col = elenco.filter((d) => scelti.has(d.id));
    const tab = nodo.querySelector(".tabella-scorre");
    if (col.length < 2) { tab.innerHTML = ""; return; }
    const righe = [["Periodo", (d) => [d.dal, d.al].filter(Boolean).join(" – ")], ["Stato", (d) => statoDispositivo(d.stato, S.imp.nomenclatura)],
      ...SPECIFICHE[tipo].map(([k, l]) => [l, (d) => d.specifiche?.[k] ?? "—"])];
    tab.innerHTML = `<table class="tabella"><thead><tr><th></th>${col.map((d) => `<th>${esc([d.marca, d.modello].filter(Boolean).join(" "))}</th>`).join("")}</tr></thead>
      <tbody>${righe.map(([l, f]) => `<tr><th>${esc(l)}</th>${col.map((d) => `<td>${esc(f(d) || "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };
  nodo.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { tipo = b.dataset.t; scelti.clear(); disegna(); }));
  disegna();
  return nodo;
}

// =====================================================================
// DIARIO PARTITE
// =====================================================================
const LUOGHI = [["", "Non indicato"], ["stadio", "Allo stadio"], ["casa", "A casa"], ["bar", "Al bar"], ["amici", "Da amici"], ["altro", "Altrove"]];
const nomeLuogo = (k) => LUOGHI.find(([v]) => v === k)?.[1] ?? "";

function esitoInter(p) {
  if (p.gol_casa == null || p.gol_trasferta == null) return null;
  const casaInter = /inter/i.test(p.casa);
  const trasfInter = /inter/i.test(p.trasferta);
  if (!casaInter && !trasfInter) return null;
  const nostri = casaInter ? p.gol_casa : p.gol_trasferta;
  const loro = casaInter ? p.gol_trasferta : p.gol_casa;
  return nostri > loro ? "V" : nostri === loro ? "N" : "P";
}

function statisticaScaramantica(partite) {
  const perLuogo = {};
  for (const p of partite) {
    const e = esitoInter(p);
    if (!e || !p.dove_vista) continue;
    perLuogo[p.dove_vista] ??= { V: 0, N: 0, P: 0 };
    perLuogo[p.dove_vista][e]++;
  }
  const voci = Object.entries(perLuogo);
  if (!voci.length) return null;
  return el(`<div class="scheda statistica">
    <h3>Statistica scaramantica</h3>
    <p class="aiuto">Come va l'Inter a seconda di dove la guardi.</p>
    ${voci.map(([k, v]) => {
      const tot = v.V + v.N + v.P;
      return `<div class="barra-stat"><span>${esc(nomeLuogo(k))}</span><div class="barra"><i style="width:${Math.round((v.V / tot) * 100)}%"></i></div><span>${Math.round((v.V / tot) * 100)}% vittorie su ${tot}</span></div>`;
    }).join("")}
  </div>`);
}

function schedaPartita(p) {
  const interCasa = /inter/i.test(p.casa);
  const risultato = p.gol_casa != null && p.gol_trasferta != null ? `${p.gol_casa} – ${p.gol_trasferta}` : "vs";
  const visto = [nomeLuogo(p.dove_vista), p.con_chi ? `con ${p.con_chi}` : ""].filter(Boolean).join(" ");
  const nodo = el(`<article class="scheda partita">
    <p class="sotto">${esc(dataIt(p.data))}${p.competizione ? `, ${esc(p.competizione)}` : ""}</p>
    <div class="tabellino"><span class="${interCasa ? "nostri" : ""}">${esc(p.casa)}</span><b>${esc(risultato)}</b><span class="${interCasa ? "" : "nostri"}">${esc(p.trasferta)}</span></div>
    ${p.stadio ? `<p class="sotto">${esc(p.stadio)}</p>` : ""}
    ${visto ? `<p class="sotto">Vista: ${esc(visto)}${p.voto ? `, voto ${p.voto}` : ""}</p>` : ""}
    ${p.ricordo ? `<p class="note">${esc(p.ricordo)}</p>` : ""}
    <button class="btn-icona piccolo" aria-label="Modifica partita">${icona("matita")}</button>
  </article>`);
  return nodo;
}

async function apriDiario() {
  const p = pannello("Diario partite");
  const disegna = async () => {
    const partite = (await supabase.from("partite").select("*").order("data", { ascending: false })).data ?? [];
    p.corpo.innerHTML = "";
    const stat = statisticaScaramantica(partite);
    if (stat) p.corpo.append(stat);
    const vita = partite.filter((x) => x.della_vita);
    const altre = partite.filter((x) => !x.della_vita);
    for (const [titolo, elenco] of [["Partite della vita", vita], ["Tutte le partite", altre]]) {
      if (!elenco.length) continue;
      p.corpo.append(el(`<h3 class="sottotitolo">${esc(titolo)}</h3>`));
      for (const x of elenco) {
        const s = schedaPartita(x);
        s.querySelector("button").addEventListener("click", () => moduloPartita(x, disegna));
        p.corpo.append(s);
      }
    }
    if (!partite.length) p.corpo.append(vuoto("Nessuna partita. Aggiungi la prima con il +."));
  };
  bottoneAggiungi(p, "Aggiungi una partita", () => moduloPartita(null, disegna));
  disegna();
}

function moduloPartita(x, poi) {
  modulo({
    titolo: x ? "Modifica partita" : "Nuova partita",
    campi: [
      { id: "data", etichetta: "Data", tipo: "data", valore: x?.data ?? new Date().toISOString().slice(0, 10) },
      { id: "competizione", etichetta: "Competizione", valore: x?.competizione },
      { id: "casa", etichetta: "Squadra di casa", valore: x?.casa ?? "Inter" },
      { id: "trasferta", etichetta: "Squadra ospite", valore: x?.trasferta },
      { id: "gol_casa", etichetta: "Gol squadra di casa", tipo: "numero", valore: x?.gol_casa },
      { id: "gol_trasferta", etichetta: "Gol squadra ospite", tipo: "numero", valore: x?.gol_trasferta },
      { id: "stadio", etichetta: "Stadio", valore: x?.stadio },
      { id: "dove_vista", etichetta: "Dove l'hai vista", tipo: "scelta", opzioni: LUOGHI, valore: x?.dove_vista ?? "" },
      { id: "con_chi", etichetta: "Con chi", valore: x?.con_chi },
      { id: "voto", etichetta: "Voto alla serata (1-10)", tipo: "numero", valore: x?.voto },
      { id: "ricordo", etichetta: "Il ricordo", tipo: "area", valore: x?.ricordo },
      { id: "della_vita", tipo: "spunta", testoSpunta: "È una partita della vita", valore: x?.della_vita },
    ],
    salva: async (v) => {
      if (!v.data || !v.casa || !v.trasferta) { avviso("Servono data e squadre.", "errore"); return false; }
      if (v.voto != null && (v.voto < 1 || v.voto > 10)) { avviso("Il voto va da 1 a 10.", "errore"); return false; }
      v.dove_vista = v.dove_vista || null;
      const { error } = x
        ? await supabase.from("partite").update(v).eq("id", x.id)
        : await supabase.from("partite").insert(v);
      if (error) { avviso("Salvataggio non riuscito.", "errore"); return false; }
      poi();
    },
    elimina: x ? async () => { await supabase.from("partite").delete().eq("id", x.id); poi(); } : null,
  });
}

// =====================================================================
// ALBUM FIGURINE
// =====================================================================
async function apriAlbum() {
  const p = pannello(t("album"));
  localStorage.setItem(`album-visto-${S.utente.id}`, new Date().toISOString());
  document.dispatchEvent(new CustomEvent("album-visto"));
  const disegna = async () => {
    const foto = (await supabase.from("foto").select("id, percorso, creato_il").order("creato_il", { ascending: false })).data ?? [];
    const urls = await urlFirmati(foto.map((f) => f.percorso));
    p.corpo.innerHTML = "";
    const barra = el(`<div class="riga-btn">
      <input id="album-scelta" type="file" accept="image/*" multiple class="file-nascosto">
      <label for="album-scelta" class="btn">${icona("camera")} Aggiungi foto</label>
      <button class="btn secondario" data-rivedi>Rivedi gli ${esc(t("highlights").toLowerCase())}</button>
    </div>`);
    barra.querySelector("[data-rivedi]").addEventListener("click", () => azioni.apertura?.({ riproduzione: true }));
    barra.querySelector("input").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      let ok = 0;
      for (const f of files) {
        avviso(`Caricamento ${ok + 1} di ${files.length}…`);
        const percorso = await caricaFile(f, "album");
        if (!percorso) continue;
        const { error } = await supabase.from("foto").insert({ percorso, origine: eOwner() ? "owner" : "festeggiato" });
        if (!error) ok++;
      }
      avviso(`${ok} foto aggiunte`);
      disegna();
    });
    p.corpo.append(barra);
    p.corpo.append(el(`<p class="aiuto">${foto.length} figurine nell'album.</p>`));
    const griglia = el(`<div class="griglia-album"></div>`);
    foto.forEach((f, i) => {
      const b = el(`<button class="figurina" aria-label="Apri foto ${i + 1}"><img alt="" loading="lazy" src="${esc(urls.get(f.percorso))}"></button>`);
      b.addEventListener("click", () => visore(foto, urls, i, disegna));
      griglia.append(b);
    });
    p.corpo.append(griglia);
  };
  disegna();
}

function visore(foto, urls, indice, poi) {
  const p = pannello("", { classe: "visore" });
  let i = indice;
  const mostra = () => {
    p.titolo(`${i + 1} di ${foto.length}`);
    p.corpo.innerHTML = `<img class="foto-intera" alt="" src="${esc(urls.get(foto[i].percorso))}">
      <div class="comandi-visore">
        <button class="btn-icona" data-p aria-label="Precedente">${icona("indietro")}</button>
        <button class="btn-icona" data-e aria-label="Elimina foto">${icona("cestino")}</button>
        <button class="btn-icona girato" data-n aria-label="Successiva">${icona("indietro")}</button>
      </div>`;
    p.corpo.querySelector("[data-p]").onclick = () => { i = (i - 1 + foto.length) % foto.length; mostra(); };
    p.corpo.querySelector("[data-n]").onclick = () => { i = (i + 1) % foto.length; mostra(); };
    p.corpo.querySelector("[data-e]").onclick = async () => {
      if (!confirm("Eliminare questa foto dall'album?")) return;
      await supabase.storage.from("foto").remove([foto[i].percorso]);
      await supabase.from("foto").delete().eq("id", foto[i].id);
      indietro();
      poi();
    };
  };
  let x0 = null;
  p.corpo.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  p.corpo.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) { i = (i + (dx < 0 ? 1 : -1) + foto.length) % foto.length; mostra(); }
    x0 = null;
  });
  mostra();
}

// =====================================================================
// BACHECA
// =====================================================================
async function apriBacheca() {
  const p = pannello(t("trofei"));
  const disegna = () => {
    p.corpo.innerHTML = "";
    const n = contaTrofei();
    p.corpo.append(el(`<p class="conteggio-trofei"><b>${n}</b> su 3 verso il Triplete</p>`));
    for (const tr of TROFEI) {
      const vinto = S.prog.trofei?.[tr.id];
      p.corpo.append(el(`<div class="trofeo-riga ${vinto ? "vinto" : ""}">
        ${icona("trofeo", "ico-trofeo")}
        <div><h3>${esc(tr.nome)}</h3><p>${vinto ? `Vinto il ${esc(new Date(vinto).toLocaleDateString("it-IT", { day: "numeric", month: "long" }))}` : `Si vince in ${esc(tr.reparto)}`}</p></div>
      </div>`));
    }
    if (n === 3) {
      const b = el(`<button class="btn grande">Rivedi il messaggio del Triplete</button>`);
      b.addEventListener("click", () => mostraTriplete());
      p.corpo.append(b);
    }
  };
  disegna();
}

// =====================================================================
// IL MISTER (guardiano)
// =====================================================================
const chiaveChat = () => `mister-chat-${S.utente.id}`;
const caricaChat = () => { try { return JSON.parse(localStorage.getItem(chiaveChat()) ?? "[]"); } catch { return []; } };
const salvaChat = (m) => { try { localStorage.setItem(chiaveChat(), JSON.stringify(m.slice(-40))); } catch { /* spazio pieno */ } };

const ERRORI_MISTER = {
  troppe_richieste: "Il Mister è in conferenza stampa. Riprova tra qualche secondo.",
  sovraccarico: "Il Mister è in conferenza stampa. Riprova tra qualche secondo.",
  modello_non_disponibile: "Il modello del Mister non è disponibile: va cambiato il segreto MODELLO_GUARDIANO in Supabase.",
  clausola_mancante: "La clausola non è impostata: va inserita dalla presidenza.",
  rete: "Connessione assente. Riprova.",
};

export function schedaChiave({ errore = null, onSalvata = () => {} } = {}) {
  const titolo = errore === "credito_esaurito" ? "Il Mister è senza ingaggio" : "Il Mister è squalificato";
  const testo = errore === "credito_esaurito"
    ? "La chiave API in uso non ha più credito. Inseriscine una con credito disponibile."
    : errore
      ? "Per farlo tornare in campo serve una chiave API Anthropic valida."
      : "Puoi usare una tua chiave API Anthropic. Viene salvata in sola scrittura: non torna mai sul telefono.";
  const nodo = el(`<div class="scheda chiave-api">
    <h3>${errore ? esc(titolo) : esc(t("chiave_mister"))}</h3>
    <p>${esc(testo)}</p>
    <label for="chiave-api-input">Chiave API</label>
    <input id="chiave-api-input" type="password" autocomplete="off" placeholder="sk-ant-…">
    <div class="riga-btn"><button class="btn">Salva la chiave</button></div>
    <p class="aiuto">La chiave si crea dalla Console Anthropic e ha una fatturazione separata dall'abbonamento a Claude.</p>
  </div>`);
  nodo.querySelector("button").addEventListener("click", async (e) => {
    const chiave = nodo.querySelector("input").value.trim();
    if (!chiave) return avviso("Incolla la chiave.", "errore");
    e.target.disabled = true;
    const r = await chiamaFunzione("guardiano", { azione: "salva_chiave", chiave });
    e.target.disabled = false;
    if (!r.ok) return avviso(r.errore === "chiave_non_valida" ? "Chiave non valida." : "Salvataggio non riuscito.", "errore");
    nodo.querySelector("input").value = "";
    avviso(r.avviso === "credito_esaurito" ? "Chiave salvata, ma senza credito." : "Chiave salvata: il Mister torna in panchina.");
    onSalvata();
  });
  return nodo;
}

function rigaClausola(testo) {
  return esc(testo).replace(/(CLAUSOLA:\s*\S+)/, '<mark class="clausola">$1</mark>').replace(/\n/g, "<br>");
}

async function apriMister() {
  const p = pannello(t("guardiano"), { classe: "chat-mister" });
  let messaggi = caricaChat();
  p.azioni.innerHTML = `<button class="btn-icona" aria-label="Nuova conversazione">${icona("scambio")}</button>`;
  p.azioni.firstElementChild.addEventListener("click", () => {
    if (!confirm("Ricominciare la conversazione con il Mister?")) return;
    messaggi = [];
    salvaChat(messaggi);
    disegna();
  });
  p.corpo.innerHTML = `<div class="chat-scorre"><div class="chat-testata">${AVATAR_MISTER}<div><strong>${esc(t("guardiano"))}</strong><p>Custode della ${esc(t("clausola").toLowerCase())}</p></div></div><div class="chat-messaggi" aria-live="polite"></div><div class="chat-errore"></div></div>
    <form class="chat-invio" novalidate>
      <label for="chat-testo" class="nascosto-vista">Scrivi al Mister</label>
      <textarea id="chat-testo" rows="1" placeholder="Scrivi al Mister…"></textarea>
      <button class="btn-icona invia" type="submit" aria-label="Invia">${icona("invia")}</button>
    </form>`;
  const box = p.corpo.querySelector(".chat-messaggi");
  const scorre = p.corpo.querySelector(".chat-scorre");
  const boxErr = p.corpo.querySelector(".chat-errore");
  const disegna = () => {
    box.innerHTML = `<div class="bolla mister">In conferenza stampa si parla. Qui, invece, comando io. Cosa vuoi, ${esc(nome())}?</div>`
      + messaggi.map((m) => `<div class="bolla ${m.role === "user" ? "tu" : "mister"}">${m.role === "user" ? esc(m.content).replace(/\n/g, "<br>") : rigaClausola(m.content)}</div>`).join("");
    scorre.scrollTop = scorre.scrollHeight;
  };
  disegna();
  const area = p.corpo.querySelector("textarea");
  area.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); p.corpo.querySelector("form").requestSubmit(); } });
  p.corpo.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const testo = area.value.trim();
    if (!testo) return;
    area.value = "";
    boxErr.innerHTML = "";
    messaggi.push({ role: "user", content: testo });
    disegna();
    box.insertAdjacentHTML("beforeend", `<div class="bolla mister scrive" aria-label="Il Mister sta scrivendo"><i></i><i></i><i></i></div>`);
    scorre.scrollTop = scorre.scrollHeight;
    const r = await chiamaFunzione("guardiano", { azione: "chat", messaggi });
    if (r.testo) {
      messaggi.push({ role: "assistant", content: r.testo });
      salvaChat(messaggi);
      disegna();
      return;
    }
    messaggi.pop();
    area.value = testo;
    disegna();
    if (["nessuna_chiave", "chiave_non_valida", "credito_esaurito"].includes(r.errore)) {
      boxErr.append(schedaChiave({ errore: r.errore, onSalvata: () => { boxErr.innerHTML = ""; } }));
    } else {
      boxErr.append(el(`<p class="avviso-chat">${esc(ERRORI_MISTER[r.errore] ?? "Il Mister non risponde. Riprova.")}</p>`));
    }
    scorre.scrollTop = scorre.scrollHeight;
  });
}

// =====================================================================
// SPOGLIATOIO (impostazioni) e catena Android
// =====================================================================
const SFONDI = [["notte", "Notte a San Siro"], ["maglia", "Maglia"], ["lavagna", "Lavagna tattica"], ["oro", "Notte di coppa"]];
const WIDGET = [["orologio", "Orologio"], ["bacheca", "Bacheca"], ["comunicati", "Comunicati ufficiali"]];

function riga({ ico, titolo, sotto = "", destra = "" }) {
  return el(`<button class="riga-impostazione">${icona(ico)}<span><strong>${esc(titolo)}</strong>${sotto ? `<small>${esc(sotto)}</small>` : ""}</span>${destra}</button>`);
}

async function apriSpogliatoio() {
  const p = pannello(t("impostazioni"));
  const disegna = () => {
    p.titolo(t("impostazioni"));
    p.corpo.innerHTML = "";
    const modo = S.imp.nomenclatura;

    const nom = el(`<div class="gruppo">
      <div class="riga-statica">${icona("scambio")}<span><strong>${esc(t("nomenclatura"))}</strong><small>Termini da bordocampo o nomi di sempre</small></span></div>
      <div class="segmentato"><button data-m="calcio">Calcio</button><button data-m="originale">Originale</button></div>
    </div>`);
    nom.querySelectorAll("[data-m]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.m === modo));
      b.addEventListener("click", async () => { await salvaImp({ nomenclatura: b.dataset.m }); azioni.rinfrescaHome?.(); disegna(); });
    });
    p.corpo.append(nom);

    const gruppo = el(`<div class="gruppo"></div>`);
    const voci = [
      { ico: "tavolozza", titolo: t("aspetto"), sotto: "Sfondo, " + t("widget").toLowerCase() + ", ordine delle app", apri: () => pannelloAspetto() },
      { ico: "lucchetto", titolo: t("sicurezza"), sotto: `${t("cambia_sequenza")}, password`, apri: () => pannelloSicurezza() },
      { ico: "chiave", titolo: t("chiave_mister"), sotto: "Usa una tua chiave per il guardiano", apri: () => pannelloChiave() },
      { ico: "aiuto", titolo: t("come_funziona"), sotto: "Rivedi il messaggio di benvenuto", apri: () => azioni.benvenuto?.() },
      { ico: "telefono", titolo: t("info"), sotto: "Modello, versione, numero build", apri: () => pannelloInfo(disegna) },
    ];
    if (S.prog.catena?.sviluppatore) voci.push({ ico: "strumenti", titolo: t("sviluppatore"), sotto: modo === "originale" ? "" : "Opzioni sviluppatore", apri: () => pannelloAreaTecnica() });
    if (eOwner()) voci.push({ ico: "valigetta", titolo: t("presidenza"), sotto: "Convocazione, link ospiti, foto", apri: () => { location.href = "presidenza/"; } });
    voci.push({ ico: "esci", titolo: t("esci"), sotto: "Esci dall'account su questo dispositivo", apri: async () => {
      if (!confirm("Uscire dall'account su questo dispositivo?")) return;
      await supabase.auth.signOut();
      location.reload();
    } });
    for (const v of voci) {
      const r = riga(v);
      r.addEventListener("click", v.apri);
      gruppo.append(r);
    }
    p.corpo.append(gruppo);
  };
  disegna();
}

function pannelloAspetto() {
  const p = pannello(t("aspetto"));
  const disegna = async () => {
    p.corpo.innerHTML = "";
    const sf = el(`<div class="gruppo"><h3 class="sottotitolo">Sfondo</h3><div class="griglia-sfondi"></div></div>`);
    for (const [k, l] of SFONDI) {
      const b = el(`<button class="sfondo-opzione sfondo-${k}" aria-pressed="${S.imp.tema === k}"><span>${esc(l)}</span></button>`);
      b.addEventListener("click", async () => { await salvaImp({ tema: k }); azioni.applicaTema?.(); disegna(); });
      sf.querySelector(".griglia-sfondi").append(b);
    }
    const foto = el(`<div class="sfondo-opzione sfondo-foto-scelta" aria-pressed="${S.imp.tema === "foto"}">
      <input id="sfondo-file" type="file" accept="image/*" class="file-nascosto"><label for="sfondo-file"><span>${icona("camera")} La tua foto</span></label></div>`);
    if (S.imp.sfondo) urlFirmato(S.imp.sfondo).then((u) => { foto.style.backgroundImage = `url("${u}")`; });
    foto.querySelector("input").addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      avviso("Caricamento dello sfondo…");
      const percorso = await caricaFile(f, "sfondi");
      if (!percorso) return avviso("Caricamento non riuscito.", "errore");
      await salvaImp({ tema: "foto", sfondo: percorso });
      azioni.applicaTema?.();
      disegna();
    });
    sf.querySelector(".griglia-sfondi").append(foto);
    p.corpo.append(sf);

    const disattivi = Array.isArray(S.imp.widget) ? S.imp.widget : [];
    const wg = el(`<div class="gruppo"><h3 class="sottotitolo">${esc(t("widget"))}</h3></div>`);
    for (const [k, l] of WIDGET) {
      const r = el(`<label class="riga-interruttore"><span>${esc(l)}</span><input type="checkbox" class="interruttore" ${disattivi.includes(k) ? "" : "checked"}></label>`);
      r.querySelector("input").addEventListener("change", async (e) => {
        const nuovi = e.target.checked ? disattivi.filter((x) => x !== k) : [...new Set([...disattivi, k])];
        await salvaImp({ widget: nuovi });
        azioni.rinfrescaHome?.();
        disegna();
      });
      wg.append(r);
    }
    p.corpo.append(wg);

    const ord = el(`<div class="gruppo"><h3 class="sottotitolo">${esc(t("ordine"))}</h3><ol class="ordine-app"></ol></div>`);
    const ordine = ordineApp();
    ordine.forEach((id, i) => {
      const app = APPS.find((a) => a.id === id);
      const li = el(`<li><span>${esc(app.nome())}</span>
        <button class="btn-icona piccolo" aria-label="Sposta su" ${i === 0 ? "disabled" : ""}>${icona("su")}</button>
        <button class="btn-icona piccolo" aria-label="Sposta giù" ${i === ordine.length - 1 ? "disabled" : ""}>${icona("giu")}</button></li>`);
      const [su, giu] = li.querySelectorAll("button");
      const sposta = async (d) => {
        const nuovo = [...ordine];
        [nuovo[i], nuovo[i + d]] = [nuovo[i + d], nuovo[i]];
        await salvaImp({ ordine_icone: nuovo });
        azioni.rinfrescaHome?.();
        disegna();
      };
      su.addEventListener("click", () => sposta(-1));
      giu.addEventListener("click", () => sposta(1));
      ord.querySelector("ol").append(li);
    });
    p.corpo.append(ord);
  };
  disegna();
}

export function ordineApp() {
  const base = APPS.filter((a) => !a.soloOwner || eOwner()).map((a) => a.id);
  const salvato = Array.isArray(S.imp.ordine_icone) ? S.imp.ordine_icone.filter((id) => base.includes(id)) : [];
  return [...salvato, ...base.filter((id) => !salvato.includes(id))];
}

function pannelloSicurezza() {
  const p = pannello(t("sicurezza"));
  p.corpo.innerHTML = `<div class="gruppo">
      <h3 class="sottotitolo">${esc(t("cambia_sequenza"))}</h3>
      <div class="area-sequenza"><p class="istruzione"></p><div class="contenitore-seq"></div></div>
      <div class="riga-btn"><button class="btn" data-salva-seq disabled>Salva</button><button class="btn secondario" data-ricomincia>Ricomincia</button></div>
    </div>
    <div class="gruppo">
      <h3 class="sottotitolo">${esc(t("cambia_password"))}</h3>
      <label for="pw-nuova">Nuova password</label><input id="pw-nuova" type="password" autocomplete="new-password">
      <label for="pw-conferma">Ripeti la password</label><input id="pw-conferma" type="password" autocomplete="new-password">
      <div class="riga-btn"><button class="btn" data-salva-pw>Salva la password</button></div>
    </div>`;
  const istr = p.corpo.querySelector(".istruzione");
  const btnSeq = p.corpo.querySelector("[data-salva-seq]");
  let prima = null;
  let confermata = null;
  const TESTO = "Disegna la nuova sequenza (almeno 4 punti).";
  istr.textContent = TESTO;
  const seq = new Sequenza(p.corpo.querySelector(".contenitore-seq"), {
    etichetta: "Nuova sequenza",
    onFine: (s) => {
      if (confermata) { confermata = null; prima = null; btnSeq.disabled = true; }
      if (s.length < 4) { seq.errore(); istr.textContent = "Servono almeno 4 punti."; return; }
      if (!prima) { prima = s; istr.textContent = "Ridisegnala per conferma."; setTimeout(() => seq.reset(), 350); return; }
      if (prima.join("-") === s.join("-")) { confermata = s; seq.ok(); istr.textContent = "Sequenza confermata."; btnSeq.disabled = false; }
      else { prima = null; seq.errore(); istr.textContent = "Non coincide. Ricomincia."; }
    },
  });
  p.corpo.querySelector("[data-ricomincia]").addEventListener("click", () => { prima = null; confermata = null; seq.reset(); istr.textContent = TESTO; btnSeq.disabled = true; });
  btnSeq.addEventListener("click", async () => {
    const hash = await hashSequenza(S.utente.id, confermata);
    if (!(await salvaImp({ sequenza_hash: hash }))) return avviso("Salvataggio non riuscito.", "errore");
    avviso("Nuova sequenza salvata");
    indietro();
  });
  p.corpo.querySelector("[data-salva-pw]").addEventListener("click", async () => {
    const a = p.corpo.querySelector("#pw-nuova").value;
    const b = p.corpo.querySelector("#pw-conferma").value;
    if (a.length < 8) return avviso("La password deve avere almeno 8 caratteri.", "errore");
    if (a !== b) return avviso("Le due password non coincidono.", "errore");
    const { error } = await supabase.auth.updateUser({ password: a });
    if (error) return avviso(`Password non aggiornata: ${error.message}`, "errore");
    avviso("Password aggiornata");
    indietro();
  });
}

async function pannelloChiave() {
  const p = pannello(t("chiave_mister"));
  const disegna = async () => {
    p.corpo.innerHTML = `<p class="aiuto">${esc(t("caricamento"))}</p>`;
    const r = await chiamaFunzione("guardiano", { azione: "stato" });
    p.corpo.innerHTML = "";
    const stato = r.chiave_personale ? "In uso: la tua chiave personale." : r.chiave_predefinita ? "In uso: la chiave del regalo." : "Nessuna chiave: il Mister non può rispondere.";
    p.corpo.append(el(`<p class="forte">${esc(stato)}</p>`));
    p.corpo.append(schedaChiave({ onSalvata: disegna }));
    if (r.chiave_personale) {
      const b = el(`<button class="btn secondario">${icona("cestino")} Rimuovi la mia chiave</button>`);
      b.addEventListener("click", async () => {
        if (!confirm("Rimuovere la tua chiave?")) return;
        await chiamaFunzione("guardiano", { azione: "rimuovi_chiave" });
        disegna();
      });
      p.corpo.append(b);
    }
  };
  disegna();
}

function pannelloInfo(rinfrescaSpogliatoio) {
  const p = pannello(t("info"));
  p.corpo.innerHTML = `<div class="gruppo info-telefono">
    <div class="riga-statica"><span><strong>Modello</strong><small>Spogliatoio Phone</small></span></div>
    <button class="riga-impostazione" data-versione><span><strong>Versione di Android</strong><small>31</small></span></button>
    <div class="riga-statica"><span><strong>Patch di sicurezza</strong><small>22 maggio 2010</small></span></div>
    <button class="riga-impostazione" data-build><span><strong>Numero build</strong><small>1908.11.11</small></span></button>
  </div>`;
  let tocchiBuild = 0;
  p.corpo.querySelector("[data-build]").addEventListener("click", async () => {
    if (S.prog.catena?.sviluppatore) return avviso(t("staff_gia"));
    tocchiBuild++;
    if (tocchiBuild >= 7) {
      await salvaProg({ catena: { ...S.prog.catena, sviluppatore: true } });
      avviso(t("staff_ok"));
      rinfrescaSpogliatoio();
    } else if (tocchiBuild >= 3) {
      avviso(t("staff_mancano", { n: 7 - tocchiBuild }));
    }
  });
  let tocchiVersione = 0;
  p.corpo.querySelector("[data-versione]").addEventListener("click", () => {
    if (++tocchiVersione < 5) return;
    tocchiVersione = 0;
    const nodo = el(`<div class="uovo" role="dialog" aria-label="Versione 31"><div class="uovo-numero">31</div><p>Versione 31. Nome in codice: Nerazzurro.</p><button class="btn" data-chiudi>Chiudi</button></div>`);
    getSchermo().append(nodo);
    nodo.querySelector("button").addEventListener("click", () => nodo.remove());
  });
}

function pannelloAreaTecnica() {
  const p = pannello(t("sviluppatore"));
  const disegna = () => {
    const c = S.prog.catena ?? {};
    p.corpo.innerHTML = "";
    const g = el(`<div class="gruppo"></div>`);
    const oem = el(`<label class="riga-interruttore"><span><strong>${esc(t("oem"))}</strong><small>${esc(t("oem_desc"))}</small></span><input type="checkbox" class="interruttore" ${c.oem ? "checked" : ""} ${c.bootloader ? "disabled" : ""}></label>`);
    oem.querySelector("input").addEventListener("change", async (e) => {
      await salvaProg({ catena: { ...S.prog.catena, oem: e.target.checked } });
      disegna();
    });
    g.append(oem);
    g.append(el(`<label class="riga-interruttore"><span><strong>Debug USB</strong><small>Nessun cavo, nessun problema.</small></span><input type="checkbox" class="interruttore"></label>`));
    p.corpo.append(g);

    const boot = el(`<div class="gruppo">
      <div class="riga-statica">${icona("lucchetto")}<span><strong>Bootloader</strong><small>${esc(c.bootloader ? t("bootloader_sbloccato") : t("bootloader_bloccato"))}</small></span></div>
    </div>`);
    if (!c.bootloader) {
      if (!c.oem) {
        boot.append(el(`<p class="aiuto">Attiva prima "${esc(t("oem"))}".</p>`));
      } else {
        const f = el(`<form class="riga-risposta" novalidate>
          <label for="clausola-input" class="nascosto-vista">${esc(t("clausola"))}</label>
          <input id="clausola-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(t("clausola"))}">
          <button class="btn" type="submit">${esc(t("paga_clausola"))}</button></form>`);
        f.addEventListener("submit", async (e) => {
          e.preventDefault();
          const v = f.querySelector("input").value;
          if (!S.config.clausola || normalizza(v) !== normalizza(S.config.clausola)) {
            avviso(S.imp.nomenclatura === "originale" ? "Codice non valido." : "Clausola respinta: il Mister ride ancora.", "errore");
            return;
          }
          await salvaProg({ catena: { ...S.prog.catena, bootloader: true } });
          avviso(S.imp.nomenclatura === "originale" ? "Bootloader sbloccato." : "Clausola pagata: bootloader svincolato.");
          disegna();
        });
        boot.append(f);
      }
    }
    p.corpo.append(boot);

    const rom = el(`<div class="gruppo"></div>`);
    if (c.rom) {
      rom.append(el(`<div class="riga-statica">${icona("chip")}<span><strong>ROM nerazzurra</strong><small>Installata</small></span></div>`));
      rom.append(el(`<div class="riga-statica">${icona("trofeo")}<span><strong>${esc(t("root"))}</strong><small>Attiva</small></span></div>`));
    } else {
      const b = el(`<button class="btn grande" ${c.bootloader ? "" : "disabled"}>${esc(t("rom"))}</button>`);
      b.addEventListener("click", () => installaRom(disegna));
      rom.append(b);
      if (!c.bootloader) rom.append(el(`<p class="aiuto">Serve il bootloader ${esc(t("bootloader_sbloccato").toLowerCase())}.</p>`));
    }
    p.corpo.append(rom);
  };
  disegna();
}

function installaRom(poi) {
  const passi = ["Verifica della firma… ok", "Formattazione del modulo 3-5-2… ok", "Copia degli schemi di gioco… ok",
    "Installazione della ROM nerazzurra… ok", "Consegna della fascia da capitano… ok"];
  const nodo = el(`<div class="installazione" role="dialog" aria-label="Installazione ROM">
    <h2>${esc(t("rom"))}</h2><div class="progresso"><i></i></div><ol class="log"></ol><button class="btn grande nascosto">Riavvia</button></div>`);
  getSchermo().append(nodo);
  const barra = nodo.querySelector(".progresso i");
  const log = nodo.querySelector(".log");
  passi.forEach((testo, i) => setTimeout(() => {
    barra.style.width = `${((i + 1) / passi.length) * 100}%`;
    log.insertAdjacentHTML("beforeend", `<li>${esc(testo)}</li>`);
    if (i === passi.length - 1) nodo.querySelector("button").classList.remove("nascosto");
  }, 800 * (i + 1)));
  nodo.querySelector("button").addEventListener("click", async () => {
    nodo.remove();
    await salvaProg({ catena: { ...S.prog.catena, rom: true } });
    poi();
    await assegnaTrofeo("champions");
  });
}
