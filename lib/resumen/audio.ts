"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { extraerAudio, SAMPLE_RATE } from "@/lib/video/audio";
import { blobURL, CORE, VENDOR } from "@/lib/video/export";

/*
 * Pulls the audio out of the video, in ~90 s pieces small enough to upload one
 * by one. ffmpeg.wasm reads the file in place (WORKERFS) and copies the audio
 * stream without decoding it, so even an hour-long video takes seconds and
 * little memory, on phones too.
 */

export type Fragmento = { blob: Blob; nombre: string; inicio: number; duracion: number };
export type AvanceAudio = { fase: "cargando" | "extrayendo"; progreso: number };

export const SEGUNDOS_FRAGMENTO = 90;

let ffP: Promise<FFmpeg> | null = null;
async function cargar(onDescarga: (p: number) => void) {
  const mod: typeof import("@ffmpeg/ffmpeg") = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ VENDOR);
  const ff = new mod.FFmpeg();
  const [coreURL, wasmURL] = await Promise.all([
    blobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
    blobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm", onDescarga),
  ]);
  await ff.load({ coreURL, wasmURL });
  return ff;
}

type Formato = { codec: string; ext: string; muxer: string; copiar: boolean };
function formatoPara(codec: string): Formato {
  if (codec === "aac") return { codec, ext: "m4a", muxer: "mp4", copiar: true };
  if (codec === "mp3") return { codec, ext: "mp3", muxer: "mp3", copiar: true };
  if (codec === "opus" || codec === "vorbis") return { codec, ext: "webm", muxer: "webm", copiar: true };
  return { codec, ext: "m4a", muxer: "mp4", copiar: false };
}

async function conFFmpeg(file: File, duracion: number, onAvance: (a: AvanceAudio) => void, signal: AbortSignal) {
  onAvance({ fase: "cargando", progreso: 0 });
  ffP ??= cargar((p) => onAvance({ fase: "cargando", progreso: p }));
  let ff: FFmpeg;
  try {
    ff = await ffP;
  } catch (e) {
    ffP = null;
    throw e;
  }
  const abortar = () => {
    ff.terminate();
    ffP = null;
  };
  signal.addEventListener("abort", abortar, { once: true });

  try {
    await ff.createDir("/in").catch(() => {});
    await ff.createDir("/out").catch(() => {});
    await ff.mount("WORKERFS" as never, { files: [file] }, "/in");
    const entrada = "/in/" + file.name;

    // Probe: which audio codec does it have?
    let log = "";
    const leerLog = ({ message }: { message: string }) => {
      log += message + "\n";
    };
    ff.on("log", leerLog);
    await ff.exec(["-hide_banner", "-i", entrada]).catch(() => 1);
    ff.off("log", leerLog);
    const m = /Stream #0:\d+[^:]*: Audio: (\w+)/.exec(log);
    if (!m) throw new SinAudio();

    const onLog = ({ message }: { message: string }) => {
      const t = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
      if (t && duracion > 0) {
        const s = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
        onAvance({ fase: "extrayendo", progreso: Math.min(0.99, s / duracion) });
      }
    };
    ff.on("log", onLog);
    onAvance({ fase: "extrayendo", progreso: 0 });

    const intentar = async (f: Formato) => {
      const args = ["-hide_banner", "-i", entrada, "-map", "0:a:0", "-vn"];
      args.push(...(f.copiar ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "48k", "-ac", "1", "-ar", "22050"]));
      args.push(
        "-f", "segment",
        "-segment_time", String(SEGUNDOS_FRAGMENTO),
        "-segment_format", f.muxer,
        "-reset_timestamps", "1",
        "-segment_list", "/out/lista.csv",
        "-segment_list_type", "csv",
        `/out/c%04d.${f.ext}`,
      );
      return ff.exec(args);
    };

    let fmt = formatoPara(m[1]);
    let codigo = await intentar(fmt);
    if (codigo !== 0 && fmt.copiar && !signal.aborted) {
      await limpiarSalida(ff);
      fmt = { ...fmt, ext: "m4a", muxer: "mp4", copiar: false };
      codigo = await intentar(fmt);
    }
    ff.off("log", onLog);
    if (signal.aborted) throw new DOMException("cancelado", "AbortError");
    if (codigo !== 0) throw new Error("ffmpeg " + codigo);

    const lista = new TextDecoder().decode((await ff.readFile("/out/lista.csv")) as Uint8Array);
    const tipo = fmt.ext === "mp3" ? "audio/mpeg" : fmt.ext === "webm" ? "audio/webm" : "audio/mp4";
    const fragmentos: Fragmento[] = [];
    for (const fila of lista.split("\n")) {
      const [nombre, ini, fin] = fila.trim().split(",");
      if (!nombre) continue;
      const data = (await ff.readFile("/out/" + nombre)) as Uint8Array<ArrayBuffer>;
      await ff.deleteFile("/out/" + nombre).catch(() => {});
      const inicio = Number(ini);
      fragmentos.push({ blob: new Blob([data], { type: tipo }), nombre, inicio, duracion: Number(fin) - inicio });
    }
    await ff.deleteFile("/out/lista.csv").catch(() => {});
    await ff.unmount("/in").catch(() => {});
    onAvance({ fase: "extrayendo", progreso: 1 });
    return fragmentos.filter((f) => f.duracion > 0.3 && f.blob.size > 0);
  } catch (e) {
    await ff.unmount("/in").catch(() => {});
    await limpiarSalida(ff).catch(() => {});
    throw e;
  } finally {
    signal.removeEventListener("abort", abortar);
  }
}

async function limpiarSalida(ff: FFmpeg) {
  const nodos = await ff.listDir("/out").catch(() => []);
  for (const n of nodos) if (!n.isDir) await ff.deleteFile("/out/" + n.name).catch(() => {});
}

export class SinAudio extends Error {}

/** 16-bit mono WAV, for the fallback path. */
function wav(muestras: Float32Array, sr: number) {
  const buf = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  v.setUint32(4, 36 + muestras.length * 2, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, "data");
  v.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/* Browsers decode the whole file in memory here, so only for smaller files. */
const MAX_RESPALDO = 350 * 1024 * 1024;

export async function extraerFragmentos(
  file: File,
  duracion: number,
  onAvance: (a: AvanceAudio) => void,
  signal: AbortSignal,
): Promise<Fragmento[]> {
  try {
    return await conFFmpeg(file, duracion, onAvance, signal);
  } catch (e) {
    if (signal.aborted || e instanceof SinAudio) throw e;
    console.warn("ffmpeg no pudo extraer el audio; uso el navegador", e);
  }
  if (file.size > MAX_RESPALDO) {
    throw new Error(
      "No pudimos leer el audio de este video en tu teléfono. Prueba exportarlo como MP4 desde tu galería o súbelo desde una computadora.",
    );
  }
  onAvance({ fase: "extrayendo", progreso: 0.1 });
  const audio = await extraerAudio(file);
  const n = SEGUNDOS_FRAGMENTO * SAMPLE_RATE;
  const out: Fragmento[] = [];
  for (let i = 0; i * n < audio.length; i++) {
    const trozo = audio.subarray(i * n, Math.min(audio.length, (i + 1) * n));
    out.push({ blob: wav(trozo, SAMPLE_RATE), nombre: `c${i}.wav`, inicio: i * SEGUNDOS_FRAGMENTO, duracion: trozo.length / SAMPLE_RATE });
  }
  onAvance({ fase: "extrayendo", progreso: 1 });
  return out;
}
