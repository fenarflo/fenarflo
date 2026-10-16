"use client";

import { agrupar, grupoEn, palabraEn } from "@/lib/captions/group";
import type { EstiloSub } from "@/lib/captions/estilos";
import type { Grupo, Palabra } from "@/lib/captions/types";
import type { CorteListo, PiezaLista } from "./pipeline";
import type { Narrador } from "./schema";

/*
 * Plays a summary (clips of the original + narrator) on a canvas. The same
 * code drives the preview and the export, so what you see is what you get.
 *
 * Sync: the AudioContext clock only runs while a clip is playing (it's
 * suspended during every seek), so narration scheduled on it stays aligned
 * with the clips no matter how long the phone takes to seek.
 */

export type Formato = "vertical" | "horizontal";
export type Encuadre = "llenar" | "completo";

export type OpcionesRender = {
  formato: Formato;
  encuadre: Encuadre;
  alto: 720 | 1080;
  marca: boolean;
  estilo: EstiloSub;
  narrador: Narrador;
  titulo: string;
};

type Tramo = { a: number; b: number; off: number; corte: CorteListo };
type Narr = { en: number; dur: number; buf: ArrayBuffer; grupos: Grupo[] };
export type LineaTiempo = {
  tramos: Tramo[];
  narr: Narr[];
  original: Grupo[];
  /** Length of the clips; the output can run a little longer if the last line needs it. */
  clips: number;
  total: number;
};

/** Spreads a narration line's words over its audio, in proportion to their length. */
function palabrasNarracion(texto: string, en: number, dur: number): Palabra[] {
  const ws = texto.split(/\s+/).filter(Boolean);
  const total = ws.reduce((n, w) => n + w.length + 1, 0) || 1;
  let t = en;
  return ws.map((text) => {
    const d = (dur * (text.length + 1)) / total;
    const p = { text, start: t, end: t + d * 0.94 };
    t += d;
    return p;
  });
}

export function construirLinea(pieza: PiezaLista, palabras: Palabra[], narrador: Narrador): LineaTiempo {
  const tramos: Tramo[] = [];
  let off = 0;
  for (const c of pieza.cortes) {
    tramos.push({ a: c.inicio, b: c.fin, off, corte: c });
    off += c.fin - c.inicio;
  }
  const clips = off;

  // Original speech, moved onto the output timeline.
  const enLinea: Palabra[] = [];
  for (const t of tramos) {
    for (const p of palabras) {
      if (p.start >= t.a - 0.05 && p.end <= t.b + 0.1) {
        enLinea.push({ text: p.text, start: t.off + Math.max(0, p.start - t.a), end: t.off + Math.min(t.b, p.end) - t.a });
      }
    }
  }

  // Narration plays as a queue: each line starts with its clip, or after the previous line ends.
  const narr: Narr[] = [];
  let libre = 0;
  if (narrador === "voz") {
    for (const t of tramos) {
      const c = t.corte;
      if (!c.voz || !c.vozDur) continue;
      const en = Math.max(t.off + 0.15, libre + 0.2);
      narr.push({ en, dur: c.vozDur, buf: c.voz, grupos: agrupar(palabrasNarracion(c.narracion, en, c.vozDur)) });
      libre = en + c.vozDur;
    }
  }
  return { tramos, narr, original: agrupar(enLinea), clips, total: Math.max(clips, libre + 0.4) };
}

/* ---------- Fonts: next/font family names live in CSS variables ---------- */

export function familiaCss(css: string): string {
  const raiz = getComputedStyle(document.documentElement);
  let s = css;
  for (let k = 0; k < 4 && s.includes("var("); k++) {
    s = s.replace(/var\((--[\w-]+)\)/g, (_, v: string) => raiz.getPropertyValue(v).trim() || "sans-serif");
  }
  return s;
}

/* ---------- Drawing ---------- */

const ACENTO = "#C6F432";
const TINTA = "#0E0E10";

function envolver(ctx: CanvasRenderingContext2D, texto: string, maxW: number) {
  const lineas: string[] = [];
  let cur = "";
  for (const w of texto.split(/\s+/).filter(Boolean)) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lineas.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lineas.push(cur);
  return lineas;
}

function caja(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

type Fuentes = { sub: string; display: string; sans: string };

function dibujarSubtitulo(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  base: number,
  t: number,
  grupos: Grupo[],
  e: EstiloSub,
  familia: string,
  y0: number,
) {
  const gi = grupoEn(grupos, t);
  if (gi < 0) return;
  const g = grupos[gi];
  const k = palabraEn(g, t);
  const size = e.tamano * base;
  const font = `${e.peso} ${size}px ${familia}`;
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const words = g.palabras.map((p) => (e.mayusculas ? p.text.toLocaleUpperCase("es-MX") : p.text));
  // The outline eats into word gaps, so widen them by the stroke width.
  // The active word grows ("pop") into its neighbours, so leave room for that too.
  const space = ctx.measureText(" ").width + (e.contorno ? e.contorno.grosor * base * 1.2 : 0) + size * (e.pop - 1) * 1.6;
  const maxW = W * 0.84;
  const items = words.map((w, i) => ({ w, i, width: ctx.measureText(w).width }));
  const lines: (typeof items)[] = [[]];
  let lw = 0;
  for (const it of items) {
    const cur = lines[lines.length - 1];
    const add = (cur.length ? space : 0) + it.width;
    if (lw + add > maxW && cur.length) {
      lines.push([it]);
      lw = it.width;
    } else {
      cur.push(it);
      lw += add;
    }
  }
  const lh = size * 1.18;
  lines.forEach((line, li) => {
    const y = y0 - (lines.length - 1 - li) * lh;
    const total = line.reduce((n, it, j) => n + it.width + (j ? space : 0), 0);
    let x = (W - total) / 2;
    if (e.caja) {
      const p = e.caja.padding * base;
      ctx.fillStyle = e.caja.color;
      caja(ctx, x - p, y - size * 0.92 - p * 0.5, total + p * 2, size * 1.18 + p, base * 0.012);
    }
    for (const it of line) {
      const on = it.i === k;
      const pr = on ? Math.min(1, Math.max(0, (t - g.palabras[it.i].start) / 0.12)) : 0;
      const sc = on ? 1 + (e.pop - 1) * (1 - Math.pow(1 - pr, 3)) : 1;
      ctx.save();
      const cx = x + it.width / 2;
      const cy = y - size * 0.35;
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -cy);
      ctx.font = font;
      ctx.globalAlpha = on ? 1 : e.inactivo;
      if (e.sombra) {
        ctx.shadowColor = "rgba(0,0,0,.6)";
        ctx.shadowBlur = 0.014 * base;
        ctx.shadowOffsetY = 0.004 * base;
      }
      if (e.contorno) {
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.lineWidth = e.contorno.grosor * base * 2;
        ctx.strokeStyle = e.contorno.color;
        ctx.strokeText(it.w, x, y);
      }
      ctx.fillStyle = on ? e.resaltado : e.texto;
      ctx.fillText(it.w, x, y);
      ctx.restore();
      x += it.width + space;
    }
  });
}

/** The hook card of the first seconds: dark text on the accent color. */
function dibujarTitulo(ctx: CanvasRenderingContext2D, W: number, base: number, y: number, texto: string, alpha: number, f: string) {
  if (!texto || alpha <= 0) return;
  const size = 0.064 * base;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${size}px ${f}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  const lines = envolver(ctx, texto, W * 0.78);
  const lh = size * 1.12;
  const padX = 0.034 * base;
  const padY = 0.02 * base;
  const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
  const bh = lines.length * lh + padY * 2;
  ctx.fillStyle = ACENTO;
  caja(ctx, (W - bw) / 2, y, bw, bh, 0.022 * base);
  ctx.fillStyle = TINTA;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + padY + size * 0.9 + i * lh));
  ctx.restore();
}

/** Narrator in text mode: a calm card with the line for this clip. */
function dibujarTarjeta(ctx: CanvasRenderingContext2D, W: number, base: number, y: number, texto: string, alpha: number, f: string) {
  if (!texto || alpha <= 0) return;
  const size = 0.042 * base;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `600 ${size}px ${f}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  const lines = envolver(ctx, texto, W * 0.8).slice(0, 5);
  const lh = size * 1.3;
  const pad = 0.03 * base;
  const bw = Math.min(W * 0.9, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
  const bh = lines.length * lh + pad * 1.4;
  ctx.fillStyle = "rgba(14,14,16,0.82)";
  caja(ctx, (W - bw) / 2, y, bw, bh, 0.02 * base);
  ctx.fillStyle = ACENTO;
  ctx.fillRect((W - bw) / 2 + pad * 0.6, y + pad * 0.7, 0.006 * base, bh - pad * 1.4);
  ctx.fillStyle = "#F4F4F5";
  lines.forEach((l, i) => ctx.fillText(l, W / 2 + pad * 0.2, y + pad * 0.7 + size * 0.95 + i * lh));
  ctx.restore();
}

/* ---------- Engine ---------- */

export function nuevoAudio(): AudioContext | null {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return new C();
  } catch {
    return null;
  }
}

/** The video's sound routed through Web Audio (so it can be ducked and recorded). */
export type Audio = { ac: AudioContext; gainV: GainNode | null; salida: AudioNode };

/** createMediaElementSource only works once per element: call this once and reuse the result. */
export function conectarAudio(v: HTMLVideoElement, ac: AudioContext, destino?: AudioNode): Audio {
  const salida = destino ?? ac.destination;
  try {
    const src = ac.createMediaElementSource(v);
    const gainV = ac.createGain();
    src.connect(gainV);
    gainV.connect(salida);
    return { ac, gainV, salida };
  } catch {
    return { ac, gainV: null, salida };
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Motor {
  readonly W: number;
  readonly H: number;
  private c2d: CanvasRenderingContext2D;
  private f: Fuentes;
  private estado: { tramo: number } | { hold: number; desde: number } = { tramo: 0 };
  private raf = 0;
  private ac: AudioContext | null;
  private gainV: GainNode | null;
  private salida: AudioNode | null;
  private buffers = new Map<ArrayBuffer, AudioBuffer>();
  private fuentes: AudioBufferSourceNode[] = [];
  private corriendo = false;
  ultimoTl = 0;

  constructor(
    private v: HTMLVideoElement,
    readonly canvas: HTMLCanvasElement,
    private linea: LineaTiempo,
    private o: OpcionesRender,
    audio: Audio | null,
  ) {
    const corto = o.alto;
    const largo = Math.round((corto * 16) / 9 / 2) * 2;
    this.W = o.formato === "vertical" ? corto : largo;
    this.H = o.formato === "vertical" ? largo : corto;
    canvas.width = this.W;
    canvas.height = this.H;
    this.c2d = canvas.getContext("2d")!;
    this.f = {
      sub: familiaCss(o.estilo.fuenteCss),
      display: familiaCss("var(--font-display)"),
      sans: familiaCss("var(--font-sans)"),
    };
    this.ac = audio?.ac ?? null;
    this.gainV = audio?.gainV ?? null;
    this.salida = audio?.salida ?? null;
  }

  async listo() {
    const e = this.o.estilo;
    await Promise.all([
      document.fonts.load(`${e.peso} 40px ${this.f.sub}`),
      document.fonts.load(`800 40px ${this.f.display}`),
      document.fonts.load(`600 40px ${this.f.sans}`),
    ]).catch(() => {});
    if (this.ac) {
      for (const n of this.linea.narr) {
        if (!this.buffers.has(n.buf)) this.buffers.set(n.buf, await this.ac.decodeAudioData(n.buf.slice(0)));
      }
    }
  }

  get total() {
    return this.linea.total;
  }

  /** Output time now. */
  tl(): number {
    const s = this.estado;
    if ("hold" in s) return Math.min(this.linea.total, s.hold + (this.ac ? this.ac.currentTime - s.desde : 0));
    const t = this.linea.tramos[s.tramo];
    if (!t) return 0;
    return t.off + Math.max(0, Math.min(this.v.currentTime, t.b) - t.a);
  }

  private narrando(tl: number) {
    return this.linea.narr.find((n) => tl >= n.en - 0.05 && tl < n.en + n.dur + 0.1);
  }

  pintar(tl = this.tl()) {
    this.ultimoTl = tl;
    const { W, H, c2d: ctx, o } = this;
    const base = Math.min(W, H);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const vw = this.v.videoWidth;
    const vh = this.v.videoHeight;
    const s = this.estado;
    const tramo = "tramo" in s ? this.linea.tramos[s.tramo] : this.linea.tramos[this.linea.tramos.length - 1];
    if (vw && vh && this.v.readyState >= 2) {
      // A slow push-in on each clip keeps static shots (classes, podcasts) alive.
      const local = tramo ? Math.max(0, Math.min(1, (tl - tramo.off) / Math.max(1, tramo.b - tramo.a))) : 0;
      const zoom = 1 + 0.035 * local;
      if (o.encuadre === "llenar") {
        const sc = Math.max(W / vw, H / vh) * zoom;
        ctx.drawImage(this.v, (W - vw * sc) / 2, (H - vh * sc) / 2, vw * sc, vh * sc);
      } else {
        const sb = Math.max(W / vw, H / vh) * 1.1;
        ctx.globalAlpha = 0.35;
        ctx.drawImage(this.v, (W - vw * sb) / 2, (H - vh * sb) / 2, vw * sb, vh * sb);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, W, H);
        const sc = Math.min(W / vw, H / vh) * zoom;
        ctx.drawImage(this.v, (W - vw * sc) / 2, (H - vh * sc) / 2, vw * sc, vh * sc);
      }
    }

    // Captions sit above the bottom area that TikTok/Reels cover with their own UI.
    const yCap = o.formato === "vertical" ? H * 0.7 : H * 0.88;
    const n = this.narrando(tl);
    // With a voiced narrator only the narrator is heard and captioned; the original speech stays silent.
    const soloNarrador = o.narrador === "voz" && this.linea.narr.length > 0;
    if (n) dibujarSubtitulo(ctx, W, H, base, tl, n.grupos, o.estilo, this.f.sub, yCap);
    else if (!soloNarrador) dibujarSubtitulo(ctx, W, H, base, tl, this.linea.original, o.estilo, this.f.sub, yCap);

    // Text narrator (chosen, or a line whose voice failed), after the hook card.
    const desdeTarjeta = o.titulo ? 2.6 : 0;
    if (o.narrador !== "no" && tramo?.corte.narracion && !(o.narrador === "voz" && tramo.corte.voz) && tl > desdeTarjeta) {
      const local = tl - Math.max(tramo.off, desdeTarjeta);
      const resta = tramo.off + (tramo.b - tramo.a) - tl;
      const alpha = Math.max(0, Math.min(1, local / 0.3, resta / 0.3));
      dibujarTarjeta(ctx, W, base, o.formato === "vertical" ? H * 0.12 : H * 0.06, tramo.corte.narracion, alpha, this.f.sans);
    }

    if (o.titulo && tl < 2.8) {
      const a = Math.min(1, (2.8 - tl) / 0.25, tl / 0.12 + 0.5);
      dibujarTitulo(ctx, W, base, o.formato === "vertical" ? H * 0.13 : H * 0.08, o.titulo, a, this.f.display);
    }

    if (o.marca) {
      ctx.save();
      ctx.font = `700 ${Math.round(base * 0.034)}px ${this.f.sans}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 4;
      ctx.fillText("hecho con hookly", W - base * 0.05, H * 0.06 + base * 0.034);
      ctx.restore();
    }

    if (this.gainV && this.ac) {
      // Duck the original under the narrator.
      this.gainV.gain.setTargetAtTime(soloNarrador ? 0 : 1, this.ac.currentTime, 0.08);
    }
  }

  private bucle = () => {
    this.pintar();
    if (this.corriendo) this.raf = requestAnimationFrame(this.bucle);
  };

  private buscar(t: number) {
    return new Promise<void>((r) => {
      const fin = () => {
        this.v.removeEventListener("seeked", fin);
        r();
      };
      this.v.addEventListener("seeked", fin);
      this.v.currentTime = t;
      setTimeout(fin, 2500);
    });
  }

  private esperarHasta(b: number, signal: AbortSignal) {
    return new Promise<void>((r) => {
      const v = this.v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
      let hecho = false;
      const listo = () => signal.aborted || v.ended || v.paused || v.currentTime >= b - 0.03;
      const terminar = () => {
        if (hecho) return;
        hecho = true;
        clearInterval(iv);
        r();
      };
      const chk = () => {
        if (hecho) return;
        if (listo()) return terminar();
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(chk);
        else requestAnimationFrame(chk);
      };
      // rVFC stops firing if the video stalls; poll as a backstop.
      const iv = setInterval(() => listo() && terminar(), 250);
      chk();
    });
  }

  private pararVoces() {
    for (const s of this.fuentes) {
      try {
        s.stop();
      } catch {}
    }
    this.fuentes = [];
  }

  /** Shows the frame at output time `tl` without playing. */
  async mostrar(tl: number) {
    const L = this.linea;
    const i = Math.max(0, L.tramos.findIndex((t) => tl < t.off + (t.b - t.a)));
    const t = L.tramos[i] ?? L.tramos[L.tramos.length - 1];
    this.estado = { tramo: L.tramos.indexOf(t) };
    await this.buscar(t.a + Math.max(0, Math.min(t.b - t.a, tl - t.off)));
    this.pintar(Math.min(tl, L.clips));
  }

  /**
   * Plays from `desde` to the end. With `grabadora`, the recorder only runs
   * while clips play (paused during seeks), so the file has no frozen frames.
   */
  async reproducir({
    desde = 0,
    signal,
    grabadora,
    onTiempo,
  }: {
    desde?: number;
    signal: AbortSignal;
    grabadora?: MediaRecorder;
    onTiempo?: (tl: number) => void;
  }) {
    const L = this.linea;
    const ac = this.ac;
    const v = this.v;
    const pausaRec = () => {
      if (grabadora?.state === "recording" && typeof grabadora.pause === "function") grabadora.pause();
    };
    const sigueRec = () => {
      if (grabadora?.state === "paused") grabadora.resume();
    };

    this.corriendo = true;
    this.raf = requestAnimationFrame(this.bucle);
    const tick = onTiempo ? setInterval(() => onTiempo(this.tl()), 200) : 0;
    try {
      if (ac) {
        await ac.suspend().catch(() => {});
        const t0 = ac.currentTime + 0.02;
        for (const n of L.narr) {
          if (n.en + n.dur <= desde) continue;
          const buf = this.buffers.get(n.buf);
          if (!buf || !this.salida) continue;
          const s = ac.createBufferSource();
          s.buffer = buf;
          s.connect(this.salida);
          const espera = n.en - desde;
          if (espera >= 0) s.start(t0 + espera);
          else s.start(t0, -espera);
          this.fuentes.push(s);
        }
      }

      let i = L.tramos.findIndex((t) => desde < t.off + (t.b - t.a) - 0.05);
      if (i < 0) i = L.tramos.length;
      for (; i < L.tramos.length && !signal.aborted; i++) {
        const t = L.tramos[i];
        this.estado = { tramo: i };
        const ini = t.a + Math.max(0, desde - t.off);
        desde = 0;
        pausaRec();
        if (ac) await ac.suspend().catch(() => {});
        await this.buscar(ini);
        if (signal.aborted) break;
        await v.play();
        if (ac) await ac.resume().catch(() => {});
        sigueRec();
        await this.esperarHasta(t.b, signal);
        v.pause();
      }

      // The last narration line may need a moment more than the clips: hold the last frame.
      if (!signal.aborted && L.total > L.clips + 0.05) {
        if (ac) {
          await ac.resume().catch(() => {});
          this.estado = { hold: L.clips, desde: ac.currentTime };
        } else this.estado = { hold: L.clips, desde: 0 };
        sigueRec();
        const resta = L.total - L.clips;
        const fin = performance.now() + resta * 1000;
        while (!signal.aborted && performance.now() < fin) await esperar(50);
      }
    } finally {
      clearInterval(tick);
      this.corriendo = false;
      cancelAnimationFrame(this.raf);
      v.pause();
      this.pararVoces();
      if (ac) await ac.suspend().catch(() => {});
    }
  }
}

/* ---------- Export ---------- */

export type Exportado = { blob: Blob; url: string; ext: "mp4" | "webm" };

const TIPOS = [
  "video/mp4;codecs=avc1.42E01F,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

/**
 * Must be called from the tap itself (iOS only allows audio and playback
 * there): it sets up the hidden video and audio graph synchronously, then
 * records the whole summary.
 */
export function exportarResumen({
  url,
  pieza,
  palabras,
  opciones,
  onProgreso,
}: {
  url: string;
  pieza: PiezaLista;
  palabras: Palabra[];
  opciones: OpcionesRender;
  onProgreso: (p: number) => void;
}) {
  const ctl = new AbortController();
  const v = document.createElement("video");
  v.src = url;
  v.playsInline = true;
  v.preload = "auto";
  v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(v);
  const ac = nuevoAudio();
  let dest: MediaStreamAudioDestinationNode | null = null;
  let audio: Audio | null = null;
  try {
    dest = ac?.createMediaStreamDestination() ?? null;
    if (ac && dest) audio = conectarAudio(v, ac, dest);
    ac?.resume();
  } catch {
    dest = null;
  }
  const preparado = v
    .play()
    .then(() => v.pause())
    .catch(() => {});

  const limpiar = () => {
    try {
      v.pause();
    } catch {}
    v.removeAttribute("src");
    v.load();
    v.remove();
    ac?.close().catch(() => {});
  };

  const promesa = (async (): Promise<Exportado> => {
    try {
      await Promise.all([
        preparado,
        new Promise<void>((r, j) => {
          if (v.readyState >= 2) return r();
          v.addEventListener("loadeddata", () => r(), { once: true });
          v.addEventListener("error", () => j(new Error("video")), { once: true });
        }),
      ]);
      const canvas = document.createElement("canvas");
      const linea = construirLinea(pieza, palabras, opciones.narrador);
      const motor = new Motor(v, canvas, linea, opciones, audio);
      await motor.listo();
      await motor.mostrar(0);

      const stream = canvas.captureStream(30);
      dest?.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const mime = TIPOS.find((m) => window.MediaRecorder?.isTypeSupported?.(m));
      if (!mime) throw new Error("Tu navegador no puede grabar video. Usa Safari, Chrome o Edge actualizados.");
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: opciones.alto === 1080 ? 9_000_000 : 5_000_000,
        audioBitsPerSecond: 128_000,
      });
      const partes: Blob[] = [];
      rec.ondataavailable = (e) => e.data?.size && partes.push(e.data);
      const parado = new Promise((r) => (rec.onstop = r));
      rec.start(1000);
      if (typeof rec.pause === "function") rec.pause();

      await motor.reproducir({ signal: ctl.signal, grabadora: rec, onTiempo: (t) => onProgreso(Math.min(0.99, t / linea.total)) });
      if (ctl.signal.aborted) throw new DOMException("cancelado", "AbortError");
      if (rec.state === "paused") rec.resume();
      await esperar(250);
      rec.stop();
      await parado;
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(partes, { type: mime.split(";")[0] });
      onProgreso(1);
      return { blob, url: URL.createObjectURL(blob), ext };
    } finally {
      limpiar();
    }
  })();

  return { promesa, cancelar: () => ctl.abort() };
}
