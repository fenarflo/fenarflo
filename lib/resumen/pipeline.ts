"use client";

import type { Palabra } from "@/lib/captions/types";
import { ponerCuenta } from "@/lib/cuenta";
import type { Tono } from "@/lib/estilo";
import type { CuentaPublica } from "@/lib/server/cuenta";
import { extraerFragmentos, SinAudio, type Fragmento } from "./audio";
import type { Corte, Linea, Modo, Momento, Narrador, Pieza, PlanResumen, Voz } from "./schema";

/*
 * Runs one summary from the browser: each step is a short server call, so it
 * fits serverless time limits and an hour-long video is just more calls in
 * parallel. The video itself never leaves the device; only its audio does.
 */

export type Opciones = {
  file: File;
  duracion: number;
  modo: Modo;
  objetivo: number;
  narrador: Narrador;
  voz: Voz;
  tema: string;
  tono: Tono;
};

export type Etapa = "minutos" | "audio" | "transcribir" | "analizar" | "escribir" | "voz";
export type Avance = { etapa: Etapa; progreso: number; detalle?: string };

export type CorteListo = Corte & { voz?: ArrayBuffer; vozDur?: number };
export type PiezaLista = Omit<Pieza, "cortes"> & { cortes: CorteListo[] };

export type Resultado = {
  token: string;
  opciones: Omit<Opciones, "file">;
  plan: PlanResumen;
  piezas: PiezaLista[];
  palabras: Palabra[];
  avisos: string[];
  /** Kept so a new version (other length, voice, angle) doesn't redo the transcript. */
  momentos: Momento[];
  resumenes: string[];
  variante: number;
};

export class ErrorResumen extends Error {
  constructor(
    mensaje: string,
    public codigo?: string,
  ) {
    super(mensaje);
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn` over items with at most `n` at a time, keeping order. */
async function enParalelo<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>, signal: AbortSignal) {
  const out = new Array<R>(items.length);
  let i = 0;
  const trabajador = async () => {
    while (i < items.length) {
      if (signal.aborted) throw new DOMException("cancelado", "AbortError");
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
  return out;
}

/** fetch with retries on network errors and 429/5xx; 4xx answers are final. */
async function pedir(url: string, init: () => RequestInit, signal: AbortSignal, intentos = 3): Promise<Response> {
  let ultimo: unknown;
  for (let k = 0; k < intentos; k++) {
    if (signal.aborted) throw new DOMException("cancelado", "AbortError");
    try {
      const r = await fetch(url, { ...init(), signal });
      if (r.ok) return r;
      const reintentar = r.status === 429 || r.status >= 500;
      if (!reintentar || k === intentos - 1) {
        const j = (await r.json().catch(() => ({}))) as { error?: string; codigo?: string };
        throw new ErrorResumen(j.error ?? `Error ${r.status}`, j.codigo);
      }
      ultimo = new Error(String(r.status));
    } catch (e) {
      if (e instanceof ErrorResumen || (e as Error)?.name === "AbortError") throw e;
      ultimo = e;
    }
    await espera(800 * 2 ** k + Math.random() * 400);
  }
  throw ultimo instanceof Error && !(ultimo instanceof TypeError)
    ? new ErrorResumen("El servidor no respondió. Revisa tu conexión e intenta de nuevo.")
    : new ErrorResumen("Se perdió la conexión. Revisa tu internet e intenta de nuevo.");
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/* ---------- Transcript helpers ---------- */

/** Sentences with their start time: what the model reads. */
export function lineasDe(palabras: Palabra[]): Linea[] {
  const out: Linea[] = [];
  let actual: Palabra[] = [];
  const cerrar = () => {
    if (actual.length) out.push({ t: +actual[0].start.toFixed(1), texto: actual.map((p) => p.text).join(" ") });
    actual = [];
  };
  palabras.forEach((p, i) => {
    const prev = palabras[i - 1];
    if (actual.length && (p.start - (prev?.end ?? p.start) > 0.8 || actual.length >= 24)) cerrar();
    actual.push(p);
    if (/[.!?…]$/.test(p.text) && actual.length >= 4) cerrar();
  });
  cerrar();
  return out;
}

/** ~6-minute stretches (cut at a sentence) analysed in parallel. */
function bloquesDe(lineas: Linea[], duracion: number) {
  const LARGO = 360;
  const bloques: { inicio: number; fin: number; lineas: Linea[] }[] = [];
  let actual: Linea[] = [];
  let inicio = 0;
  for (const l of lineas) {
    if (actual.length && (l.t - inicio >= LARGO || actual.length >= 480)) {
      bloques.push({ inicio, fin: l.t, lineas: actual });
      actual = [];
      inicio = l.t;
    }
    actual.push(l);
  }
  if (actual.length) bloques.push({ inicio, fin: duracion, lineas: actual });
  return bloques;
}

/** Moves a cut to word boundaries so nobody gets cut mid-word. */
export function ajustarCorte(c: Corte, palabras: Palabra[], dur: number): Corte {
  if (!palabras.length) return c;
  let inicio = c.inicio;
  let fin = c.fin;
  // Start: the word that straddles the cut, or the next one if the cut sits in a gap.
  const w0 = palabras.find((p) => p.end > inicio + 0.05);
  if (w0 && w0.start - inicio < 1.2) inicio = Math.max(0, w0.start - 0.12);
  // End: finish the word in progress, then breathe a little before the next one.
  const idx = palabras.findIndex((p) => p.start >= fin - 0.05);
  const ultima = idx === -1 ? palabras[palabras.length - 1] : palabras[Math.max(0, idx - 1)];
  if (ultima && ultima.end > fin - 1.5 && ultima.end < fin + 1.5) {
    const sig = idx === -1 ? null : palabras[idx];
    fin = Math.min(ultima.end + 0.3, sig ? Math.max(ultima.end + 0.05, sig.start - 0.02) : dur);
  }
  fin = Math.min(fin, dur);
  if (fin - inicio < 1) return c;
  return { ...c, inicio, fin };
}

/* ---------- Narration audio ---------- */

let decodificador: BaseAudioContext | null = null;
export async function duracionAudio(buf: ArrayBuffer) {
  try {
    decodificador ??= new OfflineAudioContext(1, 1, 44100);
    const a = await decodificador.decodeAudioData(buf.slice(0));
    return a.duration;
  } catch {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      return (await ctx.decodeAudioData(buf.slice(0))).duration;
    } finally {
      ctx.close().catch(() => {});
    }
  }
}

/**
 * When a narration line runs longer than its clip, lets the clip play on
 * (if the source has room before the next clip) so the voice never gets cut.
 */
function acomodarVoz(cortes: CorteListo[], dur: number) {
  return cortes.map((c, i) => {
    if (!c.vozDur) return c;
    const necesita = c.vozDur + 0.6;
    if (c.fin - c.inicio >= necesita) return c;
    const tope = Math.min(dur, cortes[i + 1]?.inicio ?? dur);
    return { ...c, fin: Math.max(c.fin, Math.min(tope, c.inicio + necesita)) };
  });
}

/* ---------- The whole run ---------- */

export async function crearResumen(
  o: Opciones,
  onAvance: (a: Avance) => void,
  signal: AbortSignal,
): Promise<Resultado> {
  const avisos: string[] = [];

  onAvance({ etapa: "minutos", progreso: 0 });
  const rt = await pedir("/api/trabajo", () => json({ duracion: o.duracion, modo: o.modo }), signal, 2);
  const { token, cuenta } = (await rt.json()) as { token: string; cuenta: CuentaPublica };
  ponerCuenta(cuenta);

  let armado = false;
  try {
    // 1. Audio
    onAvance({ etapa: "audio", progreso: 0 });
    let fragmentos: Fragmento[];
    try {
      fragmentos = await extraerFragmentos(
        o.file,
        o.duracion,
        (a) =>
          onAvance({
            etapa: "audio",
            progreso: a.fase === "cargando" ? a.progreso * 0.3 : 0.3 + a.progreso * 0.7,
            detalle: a.fase === "cargando" ? "Preparando el lector de video" : undefined,
          }),
        signal,
      );
    } catch (e) {
      if (e instanceof SinAudio) throw new ErrorResumen("Este video no tiene audio. Hookly resume lo que se dice en el video.");
      throw e;
    }
    if (!fragmentos.length) throw new ErrorResumen("No encontramos audio en este video.");

    // 2. Transcript (3 pieces at a time)
    let hechos = 0;
    onAvance({ etapa: "transcribir", progreso: 0, detalle: `0 de ${fragmentos.length} partes` });
    const partes = await enParalelo(
      fragmentos,
      3,
      async (f) => {
        const r = await pedir(
          "/api/transcribir",
          () => {
            const fd = new FormData();
            fd.append("token", token);
            fd.append("inicio", String(f.inicio));
            fd.append("duracion", String(Math.min(150, Math.max(0.5, f.duracion))));
            fd.append("audio", f.blob, f.nombre);
            return { method: "POST", body: fd };
          },
          signal,
          4,
        );
        const { palabras } = (await r.json()) as { palabras: Palabra[] };
        hechos++;
        onAvance({ etapa: "transcribir", progreso: hechos / fragmentos.length, detalle: `${hechos} de ${fragmentos.length} partes` });
        return palabras;
      },
      signal,
    );
    const palabras = partes.flat().sort((a, b) => a.start - b.start);
    if (palabras.length < 12) {
      throw new ErrorResumen("Casi no hay voz en este video. Hookly necesita que alguien hable para encontrar los puntos importantes.");
    }

    // 3. Key moments per stretch (4 at a time)
    const bloques = bloquesDe(lineasDe(palabras), o.duracion);
    let analizados = 0;
    onAvance({ etapa: "analizar", progreso: 0 });
    const analisis = await enParalelo(
      bloques,
      4,
      async (b) => {
        try {
          const r = await pedir("/api/resumen/puntos", () => json({ token, modo: o.modo, ...b }), signal, 3);
          return (await r.json()) as { resumen: string; momentos: Momento[] };
        } catch (e) {
          if ((e as Error)?.name === "AbortError" || (e as ErrorResumen).codigo === "token") throw e;
          console.warn("Tramo sin analizar", b.inicio, e);
          return null;
        } finally {
          analizados++;
          onAvance({ etapa: "analizar", progreso: analizados / bloques.length });
        }
      },
      signal,
    );
    const validos = analisis.filter((a): a is NonNullable<typeof a> => !!a);
    if (!validos.length) throw new ErrorResumen("No pudimos analizar el video. Intenta de nuevo en un momento.");
    if (validos.length < analisis.length) avisos.push("Una parte del video no se pudo analizar; el resumen usa el resto.");
    // Very long videos: keep the most important moments, still in video order.
    const todos = validos.flatMap((a) => a.momentos);
    const momentos =
      todos.length <= 240
        ? todos
        : [...todos].sort((a, b) => b.importancia - a.importancia).slice(0, 240).sort((a, b) => a.inicio - b.inicio);
    const resumenes = validos.map((a) => a.resumen).filter(Boolean);

    // 4. The plan + narrator script, 5. voice
    const { file, ...opciones } = o;
    void file;
    const r = await armarYNarrar({ token, opciones, palabras, momentos, resumenes, avisos, variante: 0 }, onAvance, signal, () => {
      armado = true;
    });
    return r;
  } catch (e) {
    if (!armado) {
      // Nothing was delivered: give the minutes back.
      fetch("/api/trabajo", { ...json({ token }), method: "DELETE", keepalive: true })
        .then((r) => r.json())
        .then((j: { cuenta?: CuentaPublica }) => j.cuenta && ponerCuenta(j.cuenta))
        .catch(() => {});
    }
    throw e;
  }
}

type Base = Pick<Resultado, "token" | "opciones" | "palabras" | "momentos" | "resumenes" | "avisos" | "variante">;

async function armarYNarrar(d: Base, onAvance: (a: Avance) => void, signal: AbortSignal, alArmar?: () => void): Promise<Resultado> {
  const o = d.opciones;
  onAvance({ etapa: "escribir", progreso: 0.3 });
  const ra = await pedir(
    "/api/resumen/armar",
    () =>
      json({
        token: d.token,
        modo: o.modo,
        objetivo: o.objetivo,
        narrador: o.narrador,
        duracionVideo: o.duracion,
        tema: o.tema,
        tono: o.tono,
        resumenes: d.resumenes,
        momentos: d.momentos,
        variante: d.variante,
      }),
    signal,
    3,
  );
  const { plan } = (await ra.json()) as { plan: PlanResumen };
  alArmar?.();
  onAvance({ etapa: "escribir", progreso: 1 });

  const base: Pieza[] = plan.modo === "shorts" ? plan.piezas : [plan.pieza];
  let piezas: PiezaLista[] = base.map((p) => ({ ...p, cortes: p.cortes.map((c) => ajustarCorte(c, d.palabras, o.duracion)) }));
  const avisos = [...d.avisos];
  if (o.narrador === "voz") {
    piezas = await generarVoces(piezas, { token: d.token, voz: o.voz, modo: o.modo, duracion: o.duracion }, onAvance, signal, avisos);
  }
  return { ...d, avisos, plan, piezas };
}

/** Another version from the same transcript: different length, narrator, voice or angle. No new minutes. */
export function rehacer(
  r: Resultado,
  cambios: Partial<Pick<Opciones, "objetivo" | "narrador" | "voz">>,
  onAvance: (a: Avance) => void,
  signal: AbortSignal,
) {
  const mismo = !cambios.objetivo || cambios.objetivo === r.opciones.objetivo;
  return armarYNarrar(
    { ...r, avisos: [], opciones: { ...r.opciones, ...cambios }, variante: mismo ? Math.min(5, r.variante + 1) : r.variante },
    onAvance,
    signal,
  );
}

export async function generarVoces(
  piezas: PiezaLista[],
  d: { token: string; voz: Voz; modo: Modo; duracion: number },
  onAvance: (a: Avance) => void,
  signal: AbortSignal,
  avisos: string[],
): Promise<PiezaLista[]> {
  const lineas = piezas.flatMap((p, i) => p.cortes.map((c, j) => ({ i, j, texto: c.narracion.trim() }))).filter((l) => l.texto);
  if (!lineas.length) return piezas;
  let hechas = 0;
  let fallidas = 0;
  onAvance({ etapa: "voz", progreso: 0 });
  const audios = await enParalelo(
    lineas,
    3,
    async (l) => {
      try {
        const r = await pedir("/api/voz", () => json({ token: d.token, texto: l.texto, voz: d.voz, modo: d.modo }), signal, 3);
        const buf = await r.arrayBuffer();
        return { ...l, buf, dur: await duracionAudio(buf) };
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e;
        fallidas++;
        return null;
      } finally {
        hechas++;
        onAvance({ etapa: "voz", progreso: hechas / lineas.length });
      }
    },
    signal,
  );
  if (fallidas) {
    avisos.push(
      fallidas === lineas.length
        ? "No se pudo generar la voz; la narración aparece como texto."
        : "Algunas frases del narrador quedaron solo en texto.",
    );
  }
  const out = piezas.map((p) => ({ ...p, cortes: p.cortes.map((c) => ({ ...c })) }));
  for (const a of audios) {
    if (a) Object.assign(out[a.i].cortes[a.j], { voz: a.buf, vozDur: a.dur });
  }
  return out.map((p) => ({ ...p, cortes: acomodarVoz(p.cortes, d.duracion) }));
}
