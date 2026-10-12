"use client";

export const MAX_DURACION_S = 10 * 60;

function esMovil() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia("(pointer: coarse)").matches;
}

/**
 * Everything runs in the browser's memory, so the size cap is lower on phones
 * and on devices that report little RAM.
 */
export function maxBytes() {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (esMovil() || (mem !== undefined && mem <= 4)) return 200 * 1024 * 1024;
  return 500 * 1024 * 1024;
}

export function mb(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

export type InfoVideo = { duracion: number; ancho: number; alto: number };

export function leerInfo(url: string): Promise<InfoVideo> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const t = window.setTimeout(() => reject(new Error("timeout")), 15000);
    v.onloadedmetadata = () => {
      window.clearTimeout(t);
      resolve({ duracion: v.duration, ancho: v.videoWidth, alto: v.videoHeight });
    };
    v.onerror = () => {
      window.clearTimeout(t);
      reject(new Error("metadata"));
    };
    v.src = url;
  });
}

/** Returns a clear message in Spanish when the video can't be processed, or null. */
export async function validarVideo(file: File, url: string): Promise<{ error: string } | { info: InfoVideo }> {
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) {
    return { error: "Ese archivo no es un video. Sube un MP4, MOV o WebM." };
  }
  const limite = maxBytes();
  if (file.size > limite) {
    return {
      error: `Tu video pesa ${mb(file.size)} MB y el máximo en este dispositivo es ${mb(limite)} MB. Expórtalo en menor calidad o recórtalo e intenta de nuevo.`,
    };
  }
  let info: InfoVideo;
  try {
    info = await leerInfo(url);
  } catch {
    return {
      error: "No pudimos abrir este video en tu navegador. Prueba con un MP4 (H.264), que es el formato más compatible.",
    };
  }
  if (!Number.isFinite(info.duracion) || info.duracion <= 0) {
    return { error: "No pudimos leer la duración del video. Prueba exportarlo de nuevo como MP4." };
  }
  if (info.duracion > MAX_DURACION_S + 1) {
    return {
      error: `Tu video dura ${Math.ceil(info.duracion / 60)} min y el máximo es 10 min. Recórtalo e intenta de nuevo.`,
    };
  }
  return { info };
}
