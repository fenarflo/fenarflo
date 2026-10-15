import type { NextRequest } from "next/server";
import { identidad, responder } from "@/lib/server/identidad";
import { ErrorProveedor, transcribirAudio } from "@/lib/server/proveedores";
import { consumir, verificar } from "@/lib/server/trabajo";

export const maxDuration = 60;

// Serverless request bodies are capped around 6 MB; the browser sends ~90 s chunks.
const MAX_BYTES = 4.5 * 1024 * 1024;

/** POST multipart { token, inicio, duracion, pista?, audio }: words of one audio chunk, in video time. */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const fail = (status: number, error: string, codigo: string) => responder({ error, codigo }, status, who.uid, nueva);

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return fail(400, "No pudimos recibir el audio.", "validacion");
  }
  const t = verificar(fd.get("token"));
  if (!t || t.u !== who.uid) return fail(401, "La sesión de este video expiró. Vuelve a empezar.", "token");
  const audio = fd.get("audio");
  const inicio = Number(fd.get("inicio"));
  const duracion = Number(fd.get("duracion"));
  if (!(audio instanceof Blob) || !audio.size || !Number.isFinite(inicio) || !(duracion > 0 && duracion <= 150)) {
    return fail(400, "Fragmento de audio no válido.", "validacion");
  }
  if (audio.size > MAX_BYTES) return fail(413, "Fragmento de audio demasiado grande.", "validacion");
  if (!(await consumir(t, "audio", Math.ceil(duracion)))) {
    return fail(429, "Este video ya usó todo su tiempo de transcripción.", "limite");
  }

  const nombre = audio instanceof File && audio.name ? audio.name : "audio.m4a";
  const pista = typeof fd.get("pista") === "string" ? String(fd.get("pista")) : undefined;
  try {
    const r = await transcribirAudio(audio, nombre, pista);
    const palabras = r.palabras.map((p) => ({
      text: p.text,
      start: +(p.start + inicio).toFixed(2),
      end: +(p.end + inicio).toFixed(2),
    }));
    return responder({ palabras }, 200, who.uid, nueva);
  } catch (e) {
    // Give the budget back so the browser can retry this chunk.
    await consumir(t, "audio", -Math.ceil(duracion));
    if (e instanceof ErrorProveedor && e.message === "config") {
      return fail(500, "Falta GROQ_API_KEY u OPENAI_API_KEY en el servidor.", "config");
    }
    if (e instanceof ErrorProveedor && e.status === 429) {
      return fail(503, "Mucha demanda en este momento. Reintentando…", "ia");
    }
    if (e instanceof ErrorProveedor && e.status === 400) {
      return fail(422, "El servicio no pudo leer este fragmento de audio.", "validacion");
    }
    console.error(e);
    return fail(502, "No se pudo transcribir este fragmento.", "ia");
  }
}
