"use client";

import type { Palabra } from "@/lib/captions/types";
import { extraerAudio } from "./audio";

export type AvanceTranscripcion =
  | { fase: "audio" }
  | { fase: "descarga"; progreso: number }
  | { fase: "transcribiendo"; progreso: number; palabras: Palabra[] };

type MensajeWorker =
  | { type: "descarga"; progreso: number }
  | { type: "listo"; device: string }
  | { type: "avance"; progreso: number; palabras: Palabra[] }
  | { type: "fin"; palabras: Palabra[] }
  | { type: "error"; mensaje: string };

// Kept alive between videos so the model only loads once per visit.
let worker: Worker | null = null;

function getWorker() {
  worker ??= new Worker("/workers/whisper.js", { type: "module" });
  return worker;
}

export class TranscripcionCancelada extends Error {}

export function transcribir(file: File, onAvance: (a: AvanceTranscripcion) => void) {
  let cancelar: () => void = () => {};

  const promesa = new Promise<Palabra[]>((resolve, reject) => {
    let activo = true;
    cancelar = () => {
      if (!activo) return;
      activo = false;
      worker?.terminate();
      worker = null;
      reject(new TranscripcionCancelada());
    };

    (async () => {
      onAvance({ fase: "audio" });
      let audio: Float32Array;
      try {
        audio = await extraerAudio(file);
      } catch {
        throw new Error(
          "No pudimos leer el audio de este video. Prueba con un MP4 o MOV que tenga sonido.",
        );
      }
      if (!activo) return;

      const w = getWorker();
      w.onmessage = (ev: MessageEvent<MensajeWorker>) => {
        if (!activo) return;
        const m = ev.data;
        if (m.type === "descarga") onAvance({ fase: "descarga", progreso: m.progreso });
        else if (m.type === "listo") onAvance({ fase: "transcribiendo", progreso: 0, palabras: [] });
        else if (m.type === "avance") onAvance({ fase: "transcribiendo", progreso: m.progreso, palabras: m.palabras });
        else if (m.type === "fin") {
          activo = false;
          resolve(m.palabras);
        } else if (m.type === "error") {
          activo = false;
          console.error(m.mensaje);
          reject(
            new Error(
              /fetch|network|Failed to load/i.test(m.mensaje)
                ? "No pudimos descargar el modelo de voz. Revisa tu conexión e intenta de nuevo."
                : "La transcripción falló en este navegador. Intenta de nuevo o usa Chrome actualizado.",
            ),
          );
        }
      };
      w.onerror = (e) => {
        if (!activo) return;
        activo = false;
        console.error(e);
        worker?.terminate();
        worker = null;
        reject(new Error("La transcripción se detuvo, posiblemente por falta de memoria. Prueba con un video más corto."));
      };
      w.postMessage({ type: "transcribir", audio }, [audio.buffer]);
    })().catch((e) => {
      if (!activo) return;
      activo = false;
      reject(e);
    });
  });

  return { promesa, cancelar: () => cancelar() };
}
