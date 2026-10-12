"use client";

import { useSyncExternalStore } from "react";
import { generarASS } from "@/lib/captions/ass";
import type { EstiloSub } from "@/lib/captions/estilos";
import { agrupar } from "@/lib/captions/group";
import type { EstiloSubId, Palabra } from "@/lib/captions/types";
import { readJSON, writeJSON } from "@/lib/storage";
import { exportar as exportarVideo, ExportacionCancelada, type FaseExport } from "./export";
import { validarVideo, type InfoVideo } from "./limits";
import { transcribir as transcribirAudio, TranscripcionCancelada, type AvanceTranscripcion } from "./transcribe";

/*
 * The subtitles session lives at module level (not in a component) so it
 * survives switching tabs: you can tweak "Mi estilo" and come back to the
 * same video, transcript and running jobs.
 */

export type Fase = "vacio" | "validando" | "listo" | "transcribiendo" | "editor" | "exportando" | "exportado";
export type Calidad = 720 | 1080;

export type Sesion = {
  fase: Fase;
  file?: File;
  url?: string;
  info?: InfoVideo;
  error?: string;
  avanceT?: AvanceTranscripcion;
  palabras: Palabra[];
  estiloId: EstiloSubId;
  emojis: boolean;
  calidad: Calidad;
  avanceE?: FaseExport;
  resultado?: { url: string; bytes: number; nombre: string };
};

const prefs = () => readJSON<{ estiloId?: EstiloSubId; emojis?: boolean }>("subs-prefs", {});

let estado: Sesion = { fase: "vacio", palabras: [], estiloId: "bold", emojis: true, calidad: 720 };
let prefsCargadas = false;
const oyentes = new Set<() => void>();

function set(parcial: Partial<Sesion>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((l) => l());
}

function subscribe(l: () => void) {
  if (!prefsCargadas) {
    prefsCargadas = true;
    const p = prefs();
    estado = { ...estado, estiloId: p.estiloId ?? estado.estiloId, emojis: p.emojis ?? estado.emojis };
  }
  oyentes.add(l);
  return () => oyentes.delete(l);
}

const SERVIDOR: Sesion = { fase: "vacio", palabras: [], estiloId: "bold", emojis: true, calidad: 720 };

export function useSesion() {
  return useSyncExternalStore(
    subscribe,
    () => estado,
    () => SERVIDOR,
  );
}

let cancelarT: (() => void) | null = null;
let cancelarE: (() => void) | null = null;

function liberarResultado() {
  if (estado.resultado) URL.revokeObjectURL(estado.resultado.url);
}

export const sesion = {
  async elegir(file: File) {
    sesion.reiniciar();
    const url = URL.createObjectURL(file);
    set({ fase: "validando", file, url, error: undefined });
    const r = await validarVideo(file, url);
    if (estado.file !== file) return;
    if ("error" in r) {
      URL.revokeObjectURL(url);
      set({ fase: "vacio", file: undefined, url: undefined, error: r.error });
      return;
    }
    set({ fase: "listo", info: r.info });
  },

  async transcribir() {
    const { file } = estado;
    if (!file) return;
    set({ fase: "transcribiendo", error: undefined, avanceT: { fase: "audio" } });
    const job = transcribirAudio(file, (a) => {
      if (estado.file === file) set({ avanceT: a });
    });
    cancelarT = job.cancelar;
    try {
      const palabras = await job.promesa;
      if (estado.file !== file) return;
      if (!palabras.length) {
        set({
          fase: "listo",
          error: "No encontramos voz en este video. Revisa que tenga audio con alguien hablando.",
        });
        return;
      }
      set({ fase: "editor", palabras, avanceT: undefined });
    } catch (e) {
      if (estado.file !== file) return;
      if (e instanceof TranscripcionCancelada) set({ fase: "listo", avanceT: undefined });
      else set({ fase: "listo", avanceT: undefined, error: (e as Error).message });
    } finally {
      cancelarT = null;
    }
  },

  cancelarTranscripcion() {
    cancelarT?.();
  },

  setPalabras(palabras: Palabra[]) {
    set({ palabras });
  },

  setEstilo(estiloId: EstiloSubId) {
    set({ estiloId });
    writeJSON("subs-prefs", { estiloId, emojis: estado.emojis });
  },

  setEmojis(emojis: boolean) {
    set({ emojis });
    writeJSON("subs-prefs", { estiloId: estado.estiloId, emojis });
  },

  setCalidad(calidad: Calidad) {
    set({ calidad });
  },

  async exportar({ estilo, marcaDeAgua }: { estilo: EstiloSub; marcaDeAgua: boolean }) {
    const { file, info, palabras, emojis, calidad } = estado;
    if (!file || !info) return;
    liberarResultado();
    const ancho = calidad === 1080 ? 1080 : 720;
    const alto = calidad === 1080 ? 1920 : 1280;
    const ass = generarASS({
      grupos: agrupar(palabras),
      estilo,
      ancho,
      alto,
      emojis,
      marcaDeAgua,
      duracion: info.duracion,
    });
    set({ fase: "exportando", error: undefined, resultado: undefined, avanceE: { fase: "preparando", progreso: 0 } });
    const job = exportarVideo({
      file,
      ass,
      ancho,
      alto,
      duracion: info.duracion,
      onAvance: (a) => {
        if (estado.file === file) set({ avanceE: a });
      },
    });
    cancelarE = job.cancelar;
    try {
      const blob = await job.promesa;
      if (estado.file !== file) return;
      const base = file.name.replace(/\.[^.]+$/, "") || "video";
      set({
        fase: "exportado",
        avanceE: undefined,
        resultado: { url: URL.createObjectURL(blob), bytes: blob.size, nombre: `${base}-hookly.mp4` },
      });
    } catch (e) {
      if (estado.file !== file) return;
      if (e instanceof ExportacionCancelada) set({ fase: "editor", avanceE: undefined });
      else set({ fase: "editor", avanceE: undefined, error: (e as Error).message });
    } finally {
      cancelarE = null;
    }
  },

  cancelarExportacion() {
    cancelarE?.();
  },

  volverAlEditor() {
    set({ fase: "editor" });
  },

  limpiarError() {
    set({ error: undefined });
  },

  reiniciar() {
    cancelarT?.();
    cancelarE?.();
    liberarResultado();
    if (estado.url) URL.revokeObjectURL(estado.url);
    set({
      fase: "vacio",
      file: undefined,
      url: undefined,
      info: undefined,
      error: undefined,
      avanceT: undefined,
      avanceE: undefined,
      resultado: undefined,
      palabras: [],
    });
  },
};
