import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/* Every paid API Hookly calls. Keys come from environment variables only. */

// Cheap and fast; good enough to read transcripts and write short narration.
export const MODELO_TEXTO = "claude-haiku-5-5";

let anthropic: Anthropic | null = null;
export function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropic ??= new Anthropic({ maxRetries: 2, timeout: 55_000 });
  return anthropic;
}

const OPENAI_URL = () => process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

/* ---------- Speech to text: Groq (cheapest) or OpenAI, same API shape ---------- */

export function proveedorTranscripcion() {
  if (process.env.GROQ_API_KEY)
    return {
      nombre: "groq",
      url: `${process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"}/audio/transcriptions`,
      key: process.env.GROQ_API_KEY,
      modelo: process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo",
    };
  if (process.env.OPENAI_API_KEY)
    return {
      nombre: "openai",
      url: `${OPENAI_URL()}/audio/transcriptions`,
      key: process.env.OPENAI_API_KEY,
      // The only OpenAI model that returns word timestamps.
      modelo: "whisper-1",
    };
  return null;
}

export type PalabraAPI = { text: string; start: number; end: number };

export class ErrorProveedor extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export async function transcribirAudio(audio: Blob, nombre: string, pista?: string) {
  const p = proveedorTranscripcion();
  if (!p) throw new ErrorProveedor(500, "config");
  const fd = new FormData();
  fd.append("file", audio, nombre);
  fd.append("model", p.modelo);
  fd.append("language", "es");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  fd.append("timestamp_granularities[]", "segment");
  fd.append("temperature", "0");
  // Previous words help keep spelling consistent across chunks.
  if (pista) fd.append("prompt", pista.slice(-400));
  const res = await fetch(p.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}` },
    body: fd,
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Transcripción", p.nombre, res.status, txt.slice(0, 300));
    throw new ErrorProveedor(res.status, txt.slice(0, 200));
  }
  const j = (await res.json()) as {
    duration?: number;
    text?: string;
    words?: { word: string; start: number; end: number }[];
    segments?: { start: number; end: number; text: string; no_speech_prob?: number }[];
  };
  // Whisper invents text over silence; drop segments it is sure are not speech.
  const mudos = (j.segments ?? []).filter((s) => (s.no_speech_prob ?? 0) > 0.85);
  const enMudo = (t: number) => mudos.some((s) => t >= s.start && t < s.end);
  const palabras: PalabraAPI[] = (j.words ?? [])
    .map((w) => ({ text: w.word.trim(), start: w.start, end: Math.max(w.end, w.start + 0.05) }))
    .filter((w) => w.text && !enMudo(w.start));
  return { palabras, duracion: j.duration ?? 0 };
}

/* ---------- Text to speech: OpenAI ---------- */

export function vozDisponible() {
  return !!process.env.OPENAI_API_KEY;
}

export async function sintetizar(texto: string, voz: string, instrucciones: string) {
  if (!process.env.OPENAI_API_KEY) throw new ErrorProveedor(500, "config");
  const res = await fetch(`${OPENAI_URL()}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: voz,
      input: texto,
      instructions: instrucciones,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Voz", res.status, txt.slice(0, 300));
    // OpenAI answers 429 "insufficient_quota" when the account has no credit.
    if (/insufficient_quota|billing/i.test(txt)) throw new ErrorProveedor(402, "saldo");
    throw new ErrorProveedor(res.status, txt.slice(0, 200));
  }
  return res.arrayBuffer();
}
