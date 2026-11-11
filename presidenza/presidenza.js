import { supabase, chiamaFunzione } from "../js/supabase.js";
import { Sequenza } from "../js/sequenza.js";
import { avviso, messaggio, tokenCasuale, formattaDataOra, copiaTesto, comprimiImmagine, esc } from "../js/comune.js";
import { spazioUsato, barraSpazio, TESTO_LIMITI, LIMITE_BYTE } from "../js/spazio.js";

const $ = (id) => document.getElementById(id);
const URL_SITO = new URL("../", location.href).href;
const VISTE = ["vista-accesso", "vista-negata", "vista-pannello", "vista-trasferito"];
let convocato = false;

function mostra(id) {
  VISTE.forEach((v) => $(v).classList.toggle("nascosto", v !== id));
}

async function condividi(url, titolo) {
  if (navigator.share) {
    try { await navigator.share({ title: titolo, url }); return; } catch { /* annullato */ }
  }
  if (await copiaTesto(url)) avviso("Link copiato");
}

// ---------- Avvio e accesso ----------
async function avvio() {
  const { data } = await supabase.auth.getSession();
  const sessione = data?.session;
  if (!sessione) return mostra("vista-accesso");
  const { data: profilo } = await supabase.from("profili").select("ruolo").eq("user_id", sessione.user.id).maybeSingle();
  if (profilo?.ruolo !== "owner") return mostra("vista-negata");
  $("chi").textContent = sessione.user.email;
  mostra("vista-pannello");
  caricaConvoca();
  caricaOspiti();
  caricaFoto();
  caricaConfig();
  aggiornaSpazio();
}

async function aggiornaSpazio() {
  $("limiti-presidenza").innerHTML = TESTO_LIMITI.map((x) => `<li>${esc(x)}</li>`).join("");
  $("spazio-presidenza").innerHTML = barraSpazio(await spazioUsato({ forza: true }));
}

async function spazioDisponibile() {
  if ((await spazioUsato({ forza: true })) < LIMITE_BYTE * 0.95) return true;
  avviso("Spazio quasi esaurito: caricamento bloccato. Elimina qualche file.", "errore");
  return false;
}

$("form-accesso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter ?? e.target.querySelector("[type=submit]");
  btn.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({
    email: $("acc-email").value.trim(),
    password: $("acc-password").value,
  });
  btn.disabled = false;
  if (error) {
    const m = (error.message || "").toLowerCase();
    let testo;
    if (m.includes("invalid login credentials")) testo = "Email o password non corrette.";
    else if (m.includes("api key") || m.includes("apikey")) testo = "Chiave del sito non valida: controlla la Publishable key in config.js.";
    else if (m.includes("email not confirmed")) testo = "Email non confermata: l'utente va creato con la conferma automatica.";
    else if (m.includes("fetch") || m.includes("network") || m.includes("load failed")) testo = "Supabase non raggiungibile: controlla l'indirizzo del progetto in config.js.";
    else testo = `Accesso non riuscito: ${error.message}`;
    avviso(testo, "errore");
    return;
  }
  avvio();
});

document.querySelectorAll("[data-esci]").forEach((b) =>
  b.addEventListener("click", async () => { await supabase.auth.signOut(); location.reload(); }));

document.querySelectorAll("[data-mostra]").forEach((c) =>
  c.addEventListener("change", () => { $(c.dataset.mostra).type = c.checked ? "text" : "password"; }));

// ---------- Sequenza disegnata due volte ----------
function doppiaSequenza(contenitore, istruzione, onCambio) {
  const TESTO = "Disegna la sequenza (almeno 4 punti).";
  let prima = null;
  let confermata = null;
  istruzione.textContent = TESTO;
  const seq = new Sequenza(contenitore, {
    etichetta: "Sequenza di sblocco",
    onFine: (s) => {
      if (confermata) { confermata = null; prima = null; onCambio(null); }
      if (s.length < 4) {
        seq.errore();
        istruzione.textContent = "Servono almeno 4 punti. Riprova.";
        return;
      }
      if (!prima) {
        prima = s;
        istruzione.textContent = "Ridisegnala per conferma.";
        setTimeout(() => seq.reset(), 350);
        return;
      }
      if (prima.join("-") === s.join("-")) {
        confermata = s;
        seq.ok();
        istruzione.textContent = "Sequenza confermata.";
        onCambio(confermata);
      } else {
        prima = null;
        seq.errore();
        istruzione.textContent = "Non coincide. Ricomincia dalla prima.";
        onCambio(null);
      }
    },
  });
  return {
    get valore() { return confermata; },
    reset() { prima = null; confermata = null; seq.reset(); istruzione.textContent = TESTO; onCambio(null); },
  };
}

// ---------- Convoca il festeggiato ----------
const seqConvoca = doppiaSequenza($("conv-sequenza"), $("conv-istruzione"), (s) => { $("conv-invia").disabled = !s; });
$("conv-ricomincia").addEventListener("click", () => seqConvoca.reset());

const seqReimposta = doppiaSequenza($("reimp-sequenza"), $("reimp-istruzione"), (s) => { $("reimp-sequenza-btn").disabled = !s; });
$("reimp-ricomincia").addEventListener("click", () => seqReimposta.reset());

async function caricaConvoca() {
  const r = await chiamaFunzione("convoca", { azione: "stato" });
  $("convoca-caricamento").classList.add("nascosto");
  if (r.errore) {
    $("convoca-caricamento").textContent = messaggio(r.errore);
    $("convoca-caricamento").classList.remove("nascosto");
    return;
  }
  convocato = !!r.convocato;
  $("convoca-form").classList.toggle("nascosto", convocato);
  $("convoca-fatto").classList.toggle("nascosto", !convocato);
  if (convocato) {
    $("conv-email-fatto").textContent = r.email ?? "";
    $("link-sito").textContent = URL_SITO;
  }
  aggiornaTrasferisci();
}

$("convoca-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("conv-invia");
  btn.disabled = true;
  btn.textContent = "Convocazione in corso…";
  const r = await chiamaFunzione("convoca", {
    azione: "convoca",
    email: $("conv-email").value.trim(),
    password: $("conv-password").value,
    sequenza: seqConvoca.valore,
  });
  btn.textContent = "Convoca";
  if (!r.ok) {
    btn.disabled = false;
    avviso(messaggio(r.errore), "errore");
    return;
  }
  avviso("Festeggiato convocato");
  $("conv-password").value = "";
  seqConvoca.reset();
  caricaConvoca();
});

$("copia-sito").addEventListener("click", async () => {
  if (await copiaTesto(URL_SITO)) avviso("Link copiato");
});
$("condividi-sito").addEventListener("click", () => condividi(URL_SITO, "Il tuo sito"));

$("reimp-password-btn").addEventListener("click", async () => {
  const r = await chiamaFunzione("convoca", { azione: "reimposta", password: $("reimp-password").value });
  if (!r.ok) return avviso(messaggio(r.errore), "errore");
  $("reimp-password").value = "";
  avviso("Password aggiornata");
});

$("reimp-sequenza-btn").addEventListener("click", async () => {
  const r = await chiamaFunzione("convoca", { azione: "reimposta", sequenza: seqReimposta.valore });
  if (!r.ok) return avviso(messaggio(r.errore), "errore");
  seqReimposta.reset();
  avviso("Sequenza aggiornata");
});

$("revoca-btn").addEventListener("click", async () => {
  if (!confirm("Eliminare l'account del festeggiato?")) return;
  const r = await chiamaFunzione("convoca", { azione: "revoca" });
  if (!r.ok) return avviso(messaggio(r.errore), "errore");
  avviso("Convocazione revocata");
  caricaConvoca();
});

// ---------- Link ospiti ----------
let linkOspiti = null;

async function caricaOspiti() {
  const { data, error } = await supabase
    .from("link_ospiti").select("token, attivato_il, scade_il, attivo")
    .eq("attivo", true).order("attivato_il", { ascending: false }).limit(1);
  if (error) {
    $("ospiti-stato").textContent = messaggio("rete");
    return;
  }
  const link = data?.[0];
  const valido = link && new Date(link.scade_il).getTime() > Date.now();
  linkOspiti = valido ? new URL(`../ospiti/#t=${link.token}`, location.href).href : null;

  const stato = $("ospiti-stato");
  stato.classList.toggle("attivo", !!valido);
  stato.classList.toggle("chiuso", !valido);
  if (valido) stato.textContent = `Attivo fino a ${formattaDataOra(link.scade_il)}`;
  else if (link) stato.textContent = `Scaduto ${formattaDataOra(link.scade_il)}`;
  else stato.textContent = "Nessun link attivo";

  $("link-ospiti").textContent = linkOspiti ?? "";
  $("link-ospiti").classList.toggle("nascosto", !valido);
  ["ospiti-copia", "ospiti-condividi", "ospiti-disattiva"].forEach((id) => $(id).classList.toggle("nascosto", !valido));
  $("ospiti-attiva").textContent = valido ? "Riattiva per altre 48 ore (nuovo link)" : "Attiva il link per 48 ore";
}

$("ospiti-attiva").addEventListener("click", async () => {
  if (linkOspiti && !confirm("Il link attuale smetterà di funzionare. Crearne uno nuovo?")) return;
  await supabase.from("link_ospiti").update({ attivo: false }).eq("attivo", true);
  const { error } = await supabase.from("link_ospiti").insert({ token: tokenCasuale() });
  if (error) return avviso(messaggio("rete"), "errore");
  avviso("Link ospiti attivo per 48 ore");
  caricaOspiti();
});
$("ospiti-copia").addEventListener("click", async () => {
  if (linkOspiti && (await copiaTesto(linkOspiti))) avviso("Link copiato");
});
$("ospiti-condividi").addEventListener("click", () => linkOspiti && condividi(linkOspiti, "Carica le foto della serata"));
$("ospiti-disattiva").addEventListener("click", async () => {
  if (!confirm("Disattivare il link ospiti?")) return;
  await supabase.from("link_ospiti").update({ attivo: false }).eq("attivo", true);
  avviso("Link ospiti disattivato");
  caricaOspiti();
});

// ---------- Foto ----------
const ORIGINE = { ospite: "Ospite", owner: "Presidenza", festeggiato: "Festeggiato" };

async function caricaFoto() {
  const { data: righe, error } = await supabase
    .from("foto").select("id, percorso, origine, creato_il").order("creato_il", { ascending: false });
  if (error) {
    $("foto-conteggio").textContent = messaggio("rete");
    return;
  }
  $("foto-conteggio").textContent = righe.length
    ? `${righe.length} foto nell'album.`
    : "Ancora nessuna foto. Caricane qualcuna o attiva il link ospiti.";
  const griglia = $("griglia-foto");
  griglia.innerHTML = "";
  if (!righe.length) return;

  const { data: firmati } = await supabase.storage.from("foto").createSignedUrls(righe.map((r) => r.percorso), 3600);
  const urlDi = new Map((firmati ?? []).map((f) => [f.path, f.signedUrl]));
  for (const r of righe) {
    const fig = document.createElement("figure");
    fig.innerHTML = `<img loading="lazy" alt="Foto caricata da ${esc(ORIGINE[r.origine])}" src="${esc(urlDi.get(r.percorso) ?? "")}">
      <figcaption>${esc(ORIGINE[r.origine])}</figcaption>
      <button type="button" aria-label="Elimina questa foto">×</button>`;
    fig.querySelector("button").addEventListener("click", async () => {
      if (!confirm("Eliminare questa foto?")) return;
      const { error: e1 } = await supabase.storage.from("foto").remove([r.percorso]);
      const { error: e2 } = await supabase.from("foto").delete().eq("id", r.id);
      if (e1 || e2) return avviso("Eliminazione non riuscita.", "errore");
      fig.remove();
      avviso("Foto eliminata");
      aggiornaSpazio();
    });
    griglia.appendChild(fig);
  }
}

$("foto-scelta").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files ?? []);
  e.target.value = "";
  if (!files.length) return;
  if (!(await spazioDisponibile())) return;
  let fatte = 0;
  let errori = 0;
  const avanz = $("foto-avanzamento");
  for (const f of files) {
    avanz.textContent = `Caricamento ${fatte + errori + 1} di ${files.length}…`;
    const blob = (await comprimiImmagine(f)) ?? f;
    const est = blob.type === "image/jpeg" ? "jpg" : (blob.type.split("/")[1] || "jpg");
    const percorso = `presidenza/${crypto.randomUUID()}.${est}`;
    const { error: e1 } = await supabase.storage.from("foto").upload(percorso, blob, { contentType: blob.type || "image/jpeg" });
    if (e1) { errori++; continue; }
    const { error: e2 } = await supabase.from("foto").insert({ percorso, origine: "owner" });
    if (e2) { errori++; await supabase.storage.from("foto").remove([percorso]); continue; }
    fatte++;
  }
  avanz.textContent = errori ? `${fatte} caricate, ${errori} non riuscite.` : `${fatte} foto caricate.`;
  caricaFoto();
  aggiornaSpazio();
});

// ---------- Impostazioni del sito ----------
let stemmaAttuale = "";

async function caricaConfig() {
  const { data } = await supabase.from("config_sito").select("chiave, valore");
  const val = (k) => data?.find((r) => r.chiave === k)?.valore ?? "";
  $("cfg-nome").value = val("nome_festeggiato");
  $("cfg-clausola").value = val("clausola");
  stemmaAttuale = val("stemma");
  mostraStemma();
  for (const blocco of document.querySelectorAll(".suono")) mostraSuono(blocco, val(blocco.dataset.chiave));
  costruisciLoghi(val);
}

// ---------- Loghi del tris ----------
const LOGHI = [
  ["logo_inter", "Inter", "Le pedine di Ale. Se manca, si usa lo stemma."],
  ["logo_milan", "Milan", ""],
  ["logo_juventus", "Juventus", ""],
  ["logo_napoli", "Napoli", ""],
];

function costruisciLoghi(val) {
  const contenitore = $("loghi-tris");
  contenitore.innerHTML = "";
  for (const [chiave, nome, nota] of LOGHI) {
    const slot = document.createElement("div");
    slot.className = "logo-slot";
    slot.innerHTML = `<div class="vuoto-logo"></div>
      <div><strong>${esc(nome)}</strong>${nota ? `<p class="aiuto">${esc(nota)}</p>` : ""}
        <div class="riga-btn">
          <input id="file-${chiave}" type="file" accept="image/png,image/webp" class="file-nascosto">
          <label for="file-${chiave}" class="btn secondario">Carica</label>
          <button type="button" class="btn secondario nascosto" data-rimuovi>Rimuovi</button>
        </div></div>`;
    contenitore.append(slot);
    let percorso = val(chiave);
    const mostra = async () => {
      const box = slot.firstElementChild;
      slot.querySelector("[data-rimuovi]").classList.toggle("nascosto", !percorso);
      if (!percorso) { box.outerHTML = '<div class="vuoto-logo"></div>'; return; }
      const { data } = await supabase.storage.from("foto").createSignedUrl(percorso, 3600);
      const img = document.createElement("img");
      img.alt = `Logo ${nome}`;
      img.src = data?.signedUrl ?? "";
      slot.firstElementChild.replaceWith(img);
    };
    mostra();
    slot.querySelector("input").addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      if (!["image/png", "image/webp"].includes(f.type)) return avviso("Usa un'immagine PNG o WEBP.", "errore");
      if (f.size > 2 * 1024 * 1024) return avviso("Immagine troppo grande: massimo 2 MB.", "errore");
      if (!(await spazioDisponibile())) return;
      const nuovo = `sito/${chiave}-${crypto.randomUUID()}.${f.type === "image/png" ? "png" : "webp"}`;
      const { error } = await supabase.storage.from("foto").upload(nuovo, f, { contentType: f.type });
      if (error) return avviso(`Caricamento non riuscito: ${error.message}`, "errore");
      const { error: e2 } = await supabase.from("config_sito").upsert({ chiave, valore: nuovo });
      if (e2) {
        await supabase.storage.from("foto").remove([nuovo]);
        return avviso(`Salvataggio non riuscito: ${e2.message}`, "errore");
      }
      if (percorso) await supabase.storage.from("foto").remove([percorso]);
      percorso = nuovo;
      mostra();
      avviso(`Logo ${nome} salvato`);
    });
    slot.querySelector("[data-rimuovi]").addEventListener("click", async () => {
      if (!confirm(`Rimuovere il logo ${nome}?`)) return;
      const { error } = await supabase.from("config_sito").delete().eq("chiave", chiave);
      if (error) return avviso(`Rimozione non riuscita: ${error.message}`, "errore");
      if (percorso) await supabase.storage.from("foto").remove([percorso]);
      percorso = "";
      mostra();
      avviso(`Logo ${nome} rimosso`);
    });
  }
}

// ---------- Suoni ----------
const TIPI_AUDIO = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg" };

async function mostraSuono(blocco, percorso) {
  blocco.dataset.percorso = percorso || "";
  const stato = blocco.querySelector("[data-stato]");
  const audio = blocco.querySelector("audio");
  const rimuovi = blocco.querySelector("[data-rimuovi]");
  const predefinito = blocco.dataset.chiave === "suono_gol" ? "Nessun file: ai trofei non parte nessun suono" : "Nessun inno: al Triplete non parte musica";
  stato.textContent = percorso ? "File caricato" : predefinito;
  stato.classList.toggle("attivo", !!percorso);
  rimuovi.classList.toggle("nascosto", !percorso);
  audio.classList.toggle("nascosto", !percorso);
  if (percorso) {
    const { data } = await supabase.storage.from("foto").createSignedUrl(percorso, 3600);
    audio.src = data?.signedUrl ?? "";
  } else {
    audio.removeAttribute("src");
  }
}

for (const blocco of document.querySelectorAll(".suono")) {
  const chiave = blocco.dataset.chiave;
  blocco.querySelector("input[type=file]").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const est = (f.name.split(".").pop() || "").toLowerCase();
    const tipo = f.type || TIPI_AUDIO[est] || "";
    if (!tipo.startsWith("audio/")) return avviso("Il file non sembra audio. Usa un MP3.", "errore");
    if (f.size > 20 * 1024 * 1024) return avviso("File troppo grande: massimo 20 MB.", "errore");
    if (!(await spazioDisponibile())) return;
    avviso("Caricamento in corso…");
    const percorso = `sito/${chiave}-${crypto.randomUUID()}.${est || "mp3"}`;
    const { error } = await supabase.storage.from("foto").upload(percorso, f, { contentType: tipo });
    if (error) return avviso(`Caricamento non riuscito: ${error.message}`, "errore");
    const { error: e2 } = await supabase.from("config_sito").upsert({ chiave, valore: percorso });
    if (e2) {
      await supabase.storage.from("foto").remove([percorso]);
      return avviso(`Salvataggio non riuscito: ${e2.message}`, "errore");
    }
    if (blocco.dataset.percorso) await supabase.storage.from("foto").remove([blocco.dataset.percorso]);
    mostraSuono(blocco, percorso);
    avviso("Suono salvato");
    aggiornaSpazio();
  });
  blocco.querySelector("[data-rimuovi]").addEventListener("click", async () => {
    if (!confirm("Rimuovere questo suono?")) return;
    const { error } = await supabase.from("config_sito").delete().eq("chiave", chiave);
    if (error) return avviso(`Rimozione non riuscita: ${error.message}`, "errore");
    if (blocco.dataset.percorso) await supabase.storage.from("foto").remove([blocco.dataset.percorso]);
    mostraSuono(blocco, "");
    avviso("Suono rimosso");
  });
}

async function mostraStemma() {
  const img = $("stemma-anteprima");
  const presente = !!stemmaAttuale;
  img.classList.toggle("nascosto", !presente);
  $("stemma-rimuovi").classList.toggle("nascosto", !presente);
  if (!presente) return;
  const { data } = await supabase.storage.from("foto").createSignedUrl(stemmaAttuale, 3600);
  img.src = data?.signedUrl ?? "";
}

$("stemma-file").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  if (!["image/png", "image/webp"].includes(f.type)) return avviso("Usa un'immagine PNG o WEBP.", "errore");
  if (f.size > 2 * 1024 * 1024) return avviso("Immagine troppo grande: massimo 2 MB.", "errore");
  const percorso = `sito/stemma-${crypto.randomUUID()}.${f.type === "image/png" ? "png" : "webp"}`;
  const { error } = await supabase.storage.from("foto").upload(percorso, f, { contentType: f.type });
  if (error) return avviso(`Caricamento non riuscito: ${error.message}`, "errore");
  const { error: e2 } = await supabase.from("config_sito").upsert({ chiave: "stemma", valore: percorso });
  if (e2) {
    await supabase.storage.from("foto").remove([percorso]);
    return avviso(`Salvataggio non riuscito: ${e2.message}`, "errore");
  }
  if (stemmaAttuale) await supabase.storage.from("foto").remove([stemmaAttuale]);
  stemmaAttuale = percorso;
  mostraStemma();
  avviso("Stemma salvato");
});

$("stemma-rimuovi").addEventListener("click", async () => {
  if (!confirm("Rimuovere lo stemma dal sito?")) return;
  const { error } = await supabase.from("config_sito").delete().eq("chiave", "stemma");
  if (error) return avviso(`Rimozione non riuscita: ${error.message}`, "errore");
  if (stemmaAttuale) await supabase.storage.from("foto").remove([stemmaAttuale]);
  stemmaAttuale = "";
  mostraStemma();
  avviso("Stemma rimosso");
});

$("form-config").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = $("cfg-nome").value.trim();
  const clausola = $("cfg-clausola").value.trim();
  if (!nome || !clausola) return avviso("Compila entrambi i campi.", "errore");
  const { error } = await supabase.from("config_sito").upsert([
    { chiave: "nome_festeggiato", valore: nome },
    { chiave: "clausola", valore: clausola },
  ]);
  if (error) return avviso(messaggio("rete"), "errore");
  avviso("Impostazioni salvate");
});

// ---------- Trasferimento ----------
function aggiornaTrasferisci() {
  $("trasf-btn").disabled = !(convocato && $("trasf-conferma").value.trim() === "TRASFERISCI");
}
$("trasf-conferma").addEventListener("input", aggiornaTrasferisci);

$("trasf-btn").addEventListener("click", async () => {
  if (!confirm("Ultima conferma: trasferire il sito? Perderai l'accesso.")) return;
  const r = await chiamaFunzione("trasferisci", { conferma: "TRASFERISCI" });
  if (!r.ok) return avviso(messaggio(r.errore), "errore");
  await supabase.auth.signOut();
  mostra("vista-trasferito");
});

avvio();
