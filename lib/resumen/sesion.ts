"use client";

import { useSyncExternalStore } from "react";
import { mantenerDespierto } from "@/lib/despierto";
import { readJSON, writeJSON } from "@/lib/storage";
import { leerInfo, type InfoVideo } from "@/lib/video/limits";
import { MAX_VIDEO_MIN } from "@/lib/planes";
import type { Tono } from "@/lib/estilo";
import { crearResumen, ErrorResumen, rehacer, type Avance, type Resultado } from "./pipeline";
import type { Modo, Narrador, Voz } from "./schema";
import type { Encuadre, Exportado, Formato } from "./render";

/* Lives at module level so switching tabs keeps the video, the result and running jobs. */

export type Fase = "vacio" | "validando" | "listo" | "procesando" | "resultado";

export type Preferencias = {
  modo: Modo;
  objetivo: number;
  narrador: Narrador;
  voz: Voz;
  formato: Formato;
  encuadre: Encuadre;
};

export type SesionResumen = {
  fase: Fase;
  file?: File;
  url?: string;
  info?: InfoVideo;
  tema: string;
  prefs: Preferencias;
  avance?: Avance;
  error?: string;
  /** "saldo": the error is about minutes, so the screen offers plans. */
  errorCodigo?: string;
  resultado?: Resultado;
  seleccion: number;
  exportando?: { pieza: number; progreso: number };
  exportados: Record<number, Exportado & { nombre: string }>;
};

export const OBJETIVOS: Record<Modo, number[]> = {
  resumen: [30, 60, 90, 180],
  clase: [60, 180, 300],
  shorts: [20, 35, 60],
};

const PREFS_DEFAULT: Preferencias = {
  modo: "resumen",
  objetivo: 60,
  narrador: "voz",
  voz: "marin",
  formato: "vertical",
  encuadre: "llenar",
};

let estado: SesionResumen = { fase: "vacio", tema: "", prefs: PREFS_DEFAULT, seleccion: 0, exportados: {} };
let cargado = false;
const oyentes = new Set<() => void>();

function set(p: Partial<SesionResumen>) {
  estado = { ...estado, ...p };
  oyentes.forEach((l) => l());
}

const SERVIDOR = estado;
export function useResumen() {
  return useSyncExternalStore(
    (l) => {
      if (!cargado) {
        cargado = true;
        estado = { ...estado, prefs: { ...PREFS_DEFAULT, ...readJSON<Partial<Preferencias>>("resumen-prefs", {}) } };
      }
      oyentes.add(l);
      return () => oyentes.delete(l);
    },
    () => estado,
    () => SERVIDOR,
  );
}

let ctl: AbortController | null = null;
let cancelarExport: (() => void) | null = null;
let soltarExport: (() => void) | null = null;

function liberarExportados() {
  for (const e of Object.values(estado.exportados)) URL.revokeObjectURL(e.url);
}

export const resumen = {
  async elegir(file: File) {
    resumen.reiniciar();
    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/") && !/\.(mp4|mov|m4v|webm|mkv|mp3|m4a)$/i.test(file.name)) {
      set({ error: "Ese archivo no es un video. Sube un MP4, MOV o WebM." });
      return;
    }
    const url = URL.createObjectURL(file);
    set({ fase: "validando", file, url, error: undefined });
    try {
      const info = await leerInfo(url);
      if (!Number.isFinite(info.duracion) || info.duracion <= 0) throw new Error("duracion");
      if (info.duracion > MAX_VIDEO_MIN * 60 + 5) {
        URL.revokeObjectURL(url);
        set({ fase: "vacio", file: undefined, url: undefined, error: `Tu video dura ${Math.round(info.duracion / 60)} min. El máximo es ${MAX_VIDEO_MIN / 60} horas; córtalo en partes.` });
        return;
      }
      const horizontal = info.ancho > info.alto;
      // Classes are usually slides: keep them whole.
      const prefs = { ...estado.prefs, encuadre: horizontal && estado.prefs.modo === "clase" ? ("completo" as const) : estado.prefs.encuadre };
      set({ fase: "listo", info, prefs, tema: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80) });
    } catch {
      URL.revokeObjectURL(url);
      set({
        fase: "vacio",
        file: undefined,
        url: undefined,
        error: "No pudimos abrir este video en tu navegador. Prueba con un MP4 (H.264), que es el formato más compatible.",
      });
    }
  },

  setPrefs(p: Partial<Preferencias>) {
    const prefs = { ...estado.prefs, ...p };
    if (p.modo && !OBJETIVOS[p.modo].includes(prefs.objetivo)) prefs.objetivo = OBJETIVOS[p.modo][1] ?? OBJETIVOS[p.modo][0];
    if (p.modo === "clase" && estado.info && estado.info.ancho > estado.info.alto) prefs.encuadre = "completo";
    writeJSON("resumen-prefs", prefs);
    set({ prefs });
  },

  setTema(tema: string) {
    set({ tema: tema.slice(0, 200) });
  },

  /** `maxObjetivo`: longest summary the plan allows; a longer saved choice is shortened. */
  async crear(tono: Tono, maxObjetivo = Infinity) {
    const { file, info, tema } = estado;
    if (!file || !info) return;
    const permitidos = OBJETIVOS[estado.prefs.modo].filter((o) => o <= maxObjetivo);
    const prefs =
      estado.prefs.objetivo > maxObjetivo && permitidos.length
        ? { ...estado.prefs, objetivo: permitidos[permitidos.length - 1] }
        : estado.prefs;
    if (prefs !== estado.prefs) set({ prefs });
    ctl?.abort();
    ctl = new AbortController();
    liberarExportados();
    set({ fase: "procesando", error: undefined, errorCodigo: undefined, avance: { etapa: "minutos", progreso: 0 }, resultado: undefined, exportados: {}, seleccion: 0 });
    const soltar = mantenerDespierto();
    try {
      const r = await crearResumen(
        { file, duracion: info.duracion, modo: prefs.modo, objetivo: prefs.objetivo, narrador: prefs.narrador, voz: prefs.voz, tema, tono },
        (avance) => set({ avance }),
        ctl.signal,
      );
      set({ fase: "resultado", resultado: r, avance: undefined });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        set({ fase: "listo", avance: undefined });
        return;
      }
      console.error(e);
      set({
        fase: "listo",
        avance: undefined,
        error: e instanceof ErrorResumen ? e.message : (e as Error)?.message || "Algo salió mal. Intenta de nuevo.",
        errorCodigo: e instanceof ErrorResumen ? e.codigo : undefined,
      });
    } finally {
      ctl = null;
      soltar();
    }
  },

  /** New version from the same transcript (no minutes charged). */
  async rehacer(cambios: { objetivo?: number; narrador?: Narrador; voz?: Voz }) {
    const r = estado.resultado;
    if (!r) return;
    ctl?.abort();
    ctl = new AbortController();
    const anterior = estado;
    set({ fase: "procesando", error: undefined, avance: { etapa: "escribir", progreso: 0 } });
    try {
      const nuevo = await rehacer(r, cambios, (avance) => set({ avance }), ctl.signal);
      liberarExportados();
      const prefs = { ...estado.prefs, ...cambios };
      writeJSON("resumen-prefs", prefs);
      set({ fase: "resultado", resultado: nuevo, avance: undefined, exportados: {}, seleccion: 0, prefs });
    } catch (e) {
      const cancelado = (e as Error)?.name === "AbortError";
      set({
        fase: "resultado",
        resultado: anterior.resultado,
        avance: undefined,
        error: cancelado ? undefined : e instanceof ErrorResumen ? e.message : "No pudimos hacer otra versión. Intenta de nuevo.",
      });
    } finally {
      ctl = null;
    }
  },

  cancelar() {
    ctl?.abort();
  },

  seleccionar(i: number) {
    set({ seleccion: i });
  },

  empezarExport(pieza: number, cancelar: () => void) {
    const soltar = mantenerDespierto();
    cancelarExport = () => {
      soltar();
      cancelar();
    };
    soltarExport = soltar;
    set({ exportando: { pieza, progreso: 0 }, error: undefined });
  },
  progresoExport(progreso: number) {
    if (estado.exportando) set({ exportando: { ...estado.exportando, progreso } });
  },
  terminarExport(pieza: number, r: (Exportado & { nombre: string }) | null, error?: string) {
    cancelarExport = null;
    soltarExport?.();
    soltarExport = null;
    const prev = estado.exportados[pieza];
    if (r && prev) URL.revokeObjectURL(prev.url);
    set({ exportando: undefined, exportados: r ? { ...estado.exportados, [pieza]: r } : estado.exportados, error });
  },
  cancelarExport() {
    cancelarExport?.();
  },

  limpiarError() {
    set({ error: undefined, errorCodigo: undefined });
  },

  reiniciar() {
    ctl?.abort();
    cancelarExport?.();
    liberarExportados();
    if (estado.url) URL.revokeObjectURL(estado.url);
    set({ fase: "vacio", file: undefined, url: undefined, info: undefined, resultado: undefined, avance: undefined, error: undefined, errorCodigo: undefined, exportando: undefined, exportados: {}, seleccion: 0 });
  },

  /** Back to the options with the same video (new length, mode or narrator). */
  otraVez() {
    liberarExportados();
    set({ fase: "listo", resultado: undefined, exportados: {}, seleccion: 0, error: undefined });
  },
};
