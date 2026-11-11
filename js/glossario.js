// Glossario: [termine calcistico, termine originale]
export const VOCI = {
  impostazioni: ["Spogliatoio", "Impostazioni"],
  trofei: ["Bacheca", "Trofei"],
  album: ["Album figurine", "Foto"],
  highlights: ["Highlights", "Nuove foto"],
  guardiano: ["Il Mister", "Guardiano"],
  blocco: ["Tornelli", "Schermata di blocco"],
  sequenza: ["Biglietto", "Sequenza"],
  disegna: ["Mostra il biglietto: disegna la sequenza", "Disegna la sequenza per sbloccare"],
  home: ["Campo", "Home"],
  widget: ["Tabellone", "Widget"],
  notifica: ["Comunicato ufficiale", "Notifica"],
  indizi: ["Lavagna tattica", "Indizi"],
  sviluppatore: ["Area tecnica", "Opzioni sviluppatore"],
  staff_ok: ["Sei entrato nello staff tecnico!", "Ora sei uno sviluppatore!"],
  staff_gia: ["Sei già nello staff tecnico.", "Sei già uno sviluppatore."],
  staff_mancano: ["Ancora {n} tocchi per entrare nello staff tecnico.", "Ancora {n} tocchi per diventare sviluppatore."],
  oem: ["Svincolo OEM", "Sblocco OEM"],
  oem_desc: ["Permette di trattare la rescissione del bootloader.", "Consente di sbloccare il bootloader."],
  bootloader_bloccato: ["Sotto contratto", "Bloccato"],
  bootloader_sbloccato: ["Svincolato", "Sbloccato"],
  clausola: ["Clausola rescissoria", "Codice di sblocco"],
  paga_clausola: ["Paga la clausola", "Sblocca il bootloader"],
  rom: ["Cambio modulo: ROM nerazzurra", "Installa la ROM nerazzurra"],
  root: ["Fascia da capitano", "Permessi di root"],
  aggiornamento: ["Sessione di mercato", "Aggiornamento"],
  caricamento: ["Riscaldamento…", "Caricamento…"],
  esci: ["Triplice fischio", "Esci"],
  non_convocato: ["Non convocato", "Accesso negato"],
  fiato: ["Fiato", "Batteria"],
  tifo: ["Tifo", "Segnale"],
  inizia: ["Calcio d'inizio", "Inizia"],
  nomenclatura: ["Nomenclatura", "Nomenclatura"],
  aspetto: ["Aspetto", "Aspetto"],
  sicurezza: ["Sicurezza", "Sicurezza"],
  cambia_sequenza: ["Cambia il biglietto", "Cambia la sequenza"],
  cambia_password: ["Cambia la password", "Cambia la password"],
  chiave_mister: ["Chiave API del Mister", "Chiave API del guardiano"],
  come_funziona: ["Come funziona", "Come funziona"],
  info: ["Info telefono", "Info telefono"],
  ordine: ["Ordine delle app in campo", "Ordine delle app"],
  primavera: ["Primavera", "File nascosti"],
  presidenza: ["Presidenza", "Pannello owner"],
};

export const STATI_DISPOSITIVO = {
  in_uso: ["In rosa", "In uso"],
  venduto: ["Ceduto", "Venduto"],
  regalato: ["Ceduto gratis", "Regalato"],
  cassetto: ["In tribuna", "Nel cassetto"],
  riconvertito: ["Cambio ruolo", "Riconvertito"],
  rotto: ["Infortunato", "Rotto"],
  smontato: ["A fine carriera", "Smontato per i pezzi"],
};

export function traduci(chiave, modo, sostituzioni = {}) {
  const v = VOCI[chiave];
  let testo = v ? (modo === "originale" ? v[1] : v[0]) : chiave;
  for (const [k, val] of Object.entries(sostituzioni)) testo = testo.replace(`{${k}}`, val);
  return testo;
}

export function statoDispositivo(chiave, modo) {
  const v = STATI_DISPOSITIVO[chiave];
  return v ? (modo === "originale" ? v[1] : v[0]) : chiave;
}

// Icone a tratto, 24x24, colore corrente
const P = {
  auto: '<path d="M3 16v-3l2.2-5A2 2 0 0 1 7 7h10a2 2 0 0 1 1.8 1l2.2 5v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 12.5h18"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
  dado: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
  pallone: '<circle cx="12" cy="12" r="9"/><path d="M12 8.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7z"/><path d="M12 8.5V3.5M15.2 10.8l4.8-1.5M14 14.5l2.8 4M10 14.5l-2.8 4M8.8 10.8L4 9.3"/>',
  album: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 7V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3"/><path d="M3 17l4-4 3 3 2-2 5 5"/>',
  trofeo: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M9.5 17h5"/>',
  fischietto: '<circle cx="8" cy="14" r="5"/><path d="M11.5 10.5H21v4h-7"/><circle cx="8" cy="14" r="1.4" fill="currentColor"/><path d="M5 9.5L3.5 4"/>',
  regolazioni: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  valigetta: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18"/>',
  indietro: '<path d="M15 5l-7 7 7 7"/>',
  casa: '<circle cx="12" cy="12" r="7"/>',
  piu: '<path d="M12 5v14M5 12h14"/>',
  scambio: '<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>',
  tavolozza: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5 1-2 2.5-2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-11z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15" cy="8" r="1.1" fill="currentColor"/>',
  lucchetto: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  griglia: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/><path d="M6 6h12l-6 6"/>',
  chiave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  aiuto: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.4"/>',
  telefono: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  strumenti: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5L4 16.7 7.3 20l5.2-5.2a4 4 0 0 0 5-5.3l-2.4 2.4-2.6-.7-.7-2.6z"/>',
  esci: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10"/>',
  matita: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  cestino: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  colonne: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>',
  su: '<path d="M6 15l6-6 6 6"/>',
  giu: '<path d="M6 9l6 6 6-6"/>',
  chiudi: '<path d="M6 6l12 12M18 6L6 18"/>',
  invia: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  tifo: '<path d="M4 20v-3M9 20v-7M14 20v-11M19 20V5"/>',
  fiato: '<rect x="3" y="8" width="16" height="9" rx="2"/><path d="M21 11v3"/><rect x="5" y="10" width="12" height="5" rx="1" fill="currentColor" stroke="none"/>',
};

export function icona(nome, classe = "ico") {
  return `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] ?? ""}</svg>`;
}

// Il Mister: caricatura originale (allenatore inventato)
export const AVATAR_MISTER = `<svg viewBox="0 0 120 120" aria-hidden="true" class="avatar-mister">
  <circle cx="60" cy="60" r="60" fill="#1a5fd0"/>
  <path d="M14 120c4-26 22-38 46-38s42 12 46 38z" fill="#0b1430"/>
  <path d="M46 84l14 16 14-16" fill="none" stroke="#eef2f8" stroke-width="3"/>
  <path d="M60 100v10" stroke="#eef2f8" stroke-width="2"/>
  <rect x="54" y="108" width="14" height="7" rx="3.5" fill="#e0b43c"/>
  <ellipse cx="60" cy="56" rx="24" ry="28" fill="#f2c9a0"/>
  <path d="M36 50c0-18 10-26 24-26s25 7 25 24c-5-6-12-9-22-9-12 0-21 4-27 11z" fill="#3a3f4b"/>
  <path d="M43 50q6-3 12 0" stroke="#2b2f38" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M66 44q7-4 12 1" stroke="#2b2f38" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <circle cx="50" cy="57" r="2.6" fill="#1b1d24"/>
  <circle cx="71" cy="56" r="2.6" fill="#1b1d24"/>
  <path d="M59 60q-2 7 2 9" stroke="#c9946c" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M50 73q9 5 19-2" stroke="#7a3b2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <circle cx="36" cy="58" r="4.5" fill="#f2c9a0"/>
  <circle cx="84" cy="58" r="4.5" fill="#f2c9a0"/>
</svg>`;
