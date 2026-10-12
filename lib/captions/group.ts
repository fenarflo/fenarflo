import type { Grupo, Palabra } from "./types";

const MAX_PALABRAS = 3;
const MAX_CHARS = 16;
const PAUSA_CORTE = 0.6; // s of silence that forces a new line
const COLA = 0.35; // s a line stays after its last word, if nothing follows

/** Splits a word list into short on-screen lines (TikTok-style, 1–3 words). */
export function agrupar(palabras: Palabra[], maxPalabras = MAX_PALABRAS): Grupo[] {
  const grupos: Grupo[] = [];
  let actual: Palabra[] = [];
  let desde = 0;

  const cerrar = () => {
    if (!actual.length) return;
    grupos.push({ desde, palabras: actual, start: actual[0].start, end: actual[actual.length - 1].end });
    actual = [];
  };

  palabras.forEach((p, i) => {
    if (actual.length) {
      const prev = actual[actual.length - 1];
      const chars = actual.reduce((n, w) => n + w.text.length + 1, 0) + p.text.length;
      const pausa = p.start - prev.end > PAUSA_CORTE;
      const puntuacion = /[.!?…,;:]$/.test(prev.text);
      if (actual.length >= maxPalabras || chars > MAX_CHARS || pausa || puntuacion) cerrar();
    }
    if (!actual.length) desde = i;
    actual.push(p);
  });
  cerrar();

  // Let each line linger briefly, without overlapping the next one.
  for (let i = 0; i < grupos.length; i++) {
    const next = grupos[i + 1];
    grupos[i].end = Math.min(grupos[i].end + COLA, next ? next.start : Infinity);
  }
  return grupos;
}

/** Index of the active line at time t (binary search), or -1. */
export function grupoEn(grupos: Grupo[], t: number): number {
  let lo = 0;
  let hi = grupos.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const g = grupos[mid];
    if (t < g.start) hi = mid - 1;
    else if (t >= g.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Index of the highlighted word within a line: the last word that already started. */
export function palabraEn(g: Grupo, t: number): number {
  let idx = 0;
  for (let i = 0; i < g.palabras.length; i++) if (t >= g.palabras[i].start) idx = i;
  return idx;
}

/**
 * Replaces a line's words with edited text, spreading the line's time span
 * over the new words in proportion to their length.
 */
export function reemplazarGrupo(palabras: Palabra[], g: Grupo, texto: string): Palabra[] {
  const nuevas = texto.trim().split(/\s+/).filter(Boolean);
  const inicio = g.palabras[0].start;
  const fin = g.palabras[g.palabras.length - 1].end;
  const total = nuevas.reduce((n, w) => n + w.length, 0) || 1;
  let t = inicio;
  const reemplazo = nuevas.map((text) => {
    const dur = ((fin - inicio) * text.length) / total;
    const p = { text, start: t, end: t + dur };
    t += dur;
    return p;
  });
  return [...palabras.slice(0, g.desde), ...reemplazo, ...palabras.slice(g.desde + g.palabras.length)];
}

export function formatoTiempo(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
