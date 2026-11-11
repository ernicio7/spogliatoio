// Griglia 3x3 per la sequenza di sblocco, con le regole di Android:
// - ogni punto si usa una volta sola;
// - passando sopra un punto intermedio non ancora usato, viene incluso automaticamente.
// Funziona con dito, mouse e tastiera (cifre 1-9, Invio per confermare, Esc per ricominciare).

const NS = "http://www.w3.org/2000/svg";
const POS = [null, [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
const centro = (i) => [50 + POS[i][1] * 100, 50 + POS[i][0] * 100];

export class Sequenza {
  constructor(contenitore, { onFine, etichetta = "Disegna la sequenza" } = {}) {
    this.onFine = onFine;
    this.sel = [];
    this.attivo = false;
    this.bloccato = false;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 300 300");
    svg.setAttribute("class", "sequenza");
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("role", "application");
    svg.setAttribute("aria-label", `${etichetta}. Da tastiera: cifre da 1 a 9, Invio per confermare.`);

    this.gLinee = document.createElementNS(NS, "polyline");
    this.gLinee.setAttribute("class", "sequenza-linea");
    this.traccia = document.createElementNS(NS, "line");
    this.traccia.setAttribute("class", "sequenza-linea sequenza-traccia");
    svg.append(this.gLinee, this.traccia);

    this.punti = [null];
    for (let i = 1; i <= 9; i++) {
      const [x, y] = centro(i);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "sequenza-punto");
      const alone = document.createElementNS(NS, "circle");
      alone.setAttribute("cx", x); alone.setAttribute("cy", y); alone.setAttribute("r", 26);
      alone.setAttribute("class", "alone");
      const nucleo = document.createElementNS(NS, "circle");
      nucleo.setAttribute("cx", x); nucleo.setAttribute("cy", y); nucleo.setAttribute("r", 8);
      nucleo.setAttribute("class", "nucleo");
      g.append(alone, nucleo);
      svg.appendChild(g);
      this.punti.push(g);
    }

    svg.addEventListener("pointerdown", (e) => this.#inizio(e));
    svg.addEventListener("pointermove", (e) => this.#movimento(e));
    svg.addEventListener("pointerup", () => this.#fine());
    svg.addEventListener("pointercancel", () => this.#fine());
    svg.addEventListener("keydown", (e) => this.#tasto(e));

    this.svg = svg;
    contenitore.appendChild(svg);
  }

  #coord(e) {
    const r = this.svg.getBoundingClientRect();
    return [((e.clientX - r.left) * 300) / r.width, ((e.clientY - r.top) * 300) / r.height];
  }

  #vicino(x, y) {
    for (let i = 1; i <= 9; i++) {
      const [cx, cy] = centro(i);
      if (Math.hypot(cx - x, cy - y) < 36) return i;
    }
    return null;
  }

  #aggiungi(i) {
    if (this.sel.includes(i)) return;
    const prec = this.sel[this.sel.length - 1];
    if (prec) {
      const [r1, c1] = POS[prec];
      const [r2, c2] = POS[i];
      if ((r1 + r2) % 2 === 0 && (c1 + c2) % 2 === 0) {
        const medio = ((r1 + r2) / 2) * 3 + (c1 + c2) / 2 + 1;
        if (!this.sel.includes(medio)) this.sel.push(medio);
      }
    }
    this.sel.push(i);
    navigator.vibrate?.(8);
    this.#disegna();
  }

  #disegna(x, y) {
    this.gLinee.setAttribute("points", this.sel.map((i) => centro(i).join(",")).join(" "));
    for (let i = 1; i <= 9; i++) this.punti[i].classList.toggle("on", this.sel.includes(i));
    const ultimo = this.sel[this.sel.length - 1];
    if (this.attivo && ultimo && x !== undefined) {
      const [cx, cy] = centro(ultimo);
      this.traccia.setAttribute("x1", cx); this.traccia.setAttribute("y1", cy);
      this.traccia.setAttribute("x2", x); this.traccia.setAttribute("y2", y);
      this.traccia.style.display = "";
    } else {
      this.traccia.style.display = "none";
    }
  }

  #inizio(e) {
    if (this.bloccato) return;
    e.preventDefault();
    this.reset();
    this.attivo = true;
    this.svg.setPointerCapture?.(e.pointerId);
    const [x, y] = this.#coord(e);
    const i = this.#vicino(x, y);
    if (i) this.#aggiungi(i);
    this.#disegna(x, y);
  }

  #movimento(e) {
    if (!this.attivo) return;
    e.preventDefault();
    const [x, y] = this.#coord(e);
    const i = this.#vicino(x, y);
    if (i) this.#aggiungi(i);
    this.#disegna(x, y);
  }

  #fine() {
    if (!this.attivo) return;
    this.attivo = false;
    this.#disegna();
    if (this.sel.length) this.onFine?.(this.sel.slice());
  }

  #tasto(e) {
    if (this.bloccato) return;
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      this.svg.classList.remove("errore", "ok");
      this.#aggiungi(Number(e.key));
    } else if (e.key === "Enter" && this.sel.length) {
      e.preventDefault();
      this.onFine?.(this.sel.slice());
    } else if (e.key === "Escape" || e.key === "Backspace") {
      e.preventDefault();
      this.reset();
    }
  }

  reset() {
    this.sel = [];
    this.svg.classList.remove("errore", "ok");
    this.#disegna();
  }

  errore() {
    this.svg.classList.add("errore");
    this.bloccato = true;
    navigator.vibrate?.([40, 60, 40]);
    setTimeout(() => { this.bloccato = false; this.reset(); }, 800);
  }

  ok() {
    this.svg.classList.add("ok");
  }
}
