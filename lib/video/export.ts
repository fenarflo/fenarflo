"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";

/*
 * Burns the captions into a 9:16 MP4 with ffmpeg.wasm (single-thread core,
 * so no special COOP/COEP headers are needed). Nothing leaves the device.
 */

const CORE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
const VENDOR = "/vendor/ffmpeg/index.js";
// NotoEmoji-Medium.ttf only keeps its format-12 cmap: wasm libass otherwise picks
// the BMP-only table and every emoji renders as a box.
const FUENTES = [
  "BricolageGrotesque-ExtraBold.ttf",
  "DMSans-Bold.ttf",
  "Anton-Regular.ttf",
  "NotoEmoji-Medium.ttf",
];

let instancia: Promise<FFmpeg> | null = null;
let actual: FFmpeg | null = null;

/** Downloads a file into a same-origin blob: URL (the worker can't import cross-origin). */
async function blobURL(url: string, tipo: string, onProgreso?: (p: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`No se pudo descargar ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const partes: Uint8Array[] = [];
  let recibido = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    partes.push(value);
    recibido += value.length;
    if (total && onProgreso) onProgreso(Math.min(1, recibido / total));
  }
  return URL.createObjectURL(new Blob(partes as BlobPart[], { type: tipo }));
}

async function cargar(onDescarga: (p: number) => void): Promise<FFmpeg> {
  // Served from public/vendor (see scripts/vendor-ffmpeg.mjs), not bundled.
  const mod: typeof import("@ffmpeg/ffmpeg") = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ VENDOR
  );
  const ff = new mod.FFmpeg();
  actual = ff;
  const [coreURL, wasmURL] = await Promise.all([
    blobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
    blobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm", onDescarga),
  ]);
  await ff.load({ coreURL, wasmURL });

  await ff.createDir("/fonts");
  await Promise.all(
    FUENTES.map(async (f) => {
      const buf = await fetch(`/fonts/${f}`).then((r) => r.arrayBuffer());
      await ff.writeFile(`/fonts/${f}`, new Uint8Array(buf));
    }),
  );
  return ff;
}

export class ExportacionCancelada extends Error {}

export type FaseExport = { fase: "preparando"; progreso: number } | { fase: "codificando"; progreso: number };

function segundos(h: string, m: string, s: string) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function exportar({
  file,
  ass,
  ancho,
  alto,
  duracion,
  onAvance,
}: {
  file: File;
  ass: string;
  ancho: number;
  alto: number;
  duracion: number;
  onAvance: (f: FaseExport) => void;
}) {
  let cancelado = false;

  const promesa = (async () => {
    onAvance({ fase: "preparando", progreso: 0 });
    instancia ??= cargar((p) => onAvance({ fase: "preparando", progreso: p }));
    let ff: FFmpeg;
    try {
      ff = await instancia;
    } catch (e) {
      instancia = null;
      console.error(e);
      throw new Error("No pudimos cargar el editor de video. Revisa tu conexión e intenta de nuevo.");
    }
    if (cancelado) throw new ExportacionCancelada();

    await ff.writeFile("/subs.ass", new TextEncoder().encode(ass));

    let entrada = "/input/" + file.name;
    let montado = false;
    try {
      await ff.createDir("/input").catch(() => {});
      // WORKERFS reads the File in place instead of copying it into wasm memory.
      await ff.mount("WORKERFS" as never, { files: [file] }, "/input");
      montado = true;
    } catch {
      entrada = "/entrada";
      await ff.writeFile(entrada, new Uint8Array(await file.arrayBuffer()));
    }

    const onLog = ({ message }: { message: string }) => {
      const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
      if (m && duracion > 0) {
        onAvance({ fase: "codificando", progreso: Math.min(0.99, segundos(m[1], m[2], m[3]) / duracion) });
      }
    };
    ff.on("log", onLog);
    onAvance({ fase: "codificando", progreso: 0 });

    const vf = [
      "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)'",
      `scale=${ancho}:${alto}:flags=bicubic`,
      "setsar=1",
      "fps=30",
      "ass=/subs.ass:fontsdir=/fonts",
    ].join(",");

    let codigo: number;
    try {
      codigo = await ff.exec([
        "-i", entrada,
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "/salida.mp4",
      ]);
    } finally {
      ff.off("log", onLog);
    }
    if (cancelado) throw new ExportacionCancelada();
    if (codigo !== 0) {
      throw new Error("No pudimos exportar este video. Prueba con un MP4 (H.264) o un video más corto.");
    }

    const data = await ff.readFile("/salida.mp4");
    await ff.deleteFile("/salida.mp4").catch(() => {});
    if (montado) await ff.unmount("/input").catch(() => {});
    else await ff.deleteFile(entrada).catch(() => {});
    onAvance({ fase: "codificando", progreso: 1 });
    return new Blob([data as Uint8Array<ArrayBuffer>], { type: "video/mp4" });
  })().catch((e) => {
    throw cancelado ? new ExportacionCancelada() : e;
  });

  const cancelar = () => {
    cancelado = true;
    // Terminating is the only way to stop a running exec; reload next time.
    actual?.terminate();
    actual = null;
    instancia = null;
  };

  return { promesa, cancelar };
}
