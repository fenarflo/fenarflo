import "server-only";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { kv } from "./kv";

/*
 * A "trabajo" is one video being summarized. Starting one charges its minutes
 * and returns a signed token; every AI call for that video (transcribe, find
 * key moments, write the plan, voice) must carry it, and each has a budget
 * tied to the video length, so a cheap job can't be used to run up costs.
 */

export type Modo = "resumen" | "clase" | "shorts";

export type Trabajo = {
  j: string; // job id
  u: string; // uid
  s: number; // video seconds paid for
  m: Modo;
  x: number; // expiry (ms)
};

const HORAS = 8;

function secreto() {
  const s = process.env.HOOKLY_SECRET || process.env.STRIPE_SECRET_KEY || process.env.ANTHROPIC_API_KEY;
  if (!s && process.env.NODE_ENV === "production") throw new Error("Falta HOOKLY_SECRET");
  return createHash("sha256").update("hookly-trabajo:" + (s ?? "desarrollo-local")).digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function firmar(t: Omit<Trabajo, "x">): string {
  const cuerpo = b64(JSON.stringify({ ...t, x: Date.now() + HORAS * 3600_000 }));
  const firma = b64(createHmac("sha256", secreto()).update(cuerpo).digest());
  return `${cuerpo}.${firma}`;
}

export function verificar(token: unknown): Trabajo | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;
  const esperada = createHmac("sha256", secreto()).update(cuerpo).digest();
  const dada = Buffer.from(firma, "base64url");
  if (dada.length !== esperada.length || !timingSafeEqual(dada, esperada)) return null;
  try {
    const t = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as Trabajo;
    if (typeof t.x !== "number" || t.x < Date.now()) return null;
    return t;
  } catch {
    return null;
  }
}

/* Per-job budgets. Generous enough for retries, tight enough to bound cost. */
export function limites(t: Trabajo) {
  return {
    // Seconds of audio we will transcribe (a little slack for chunk overlap).
    audio: t.s + 90,
    // One "key moments" call per ~6 minutes of transcript, plus retries.
    puntos: Math.ceil(t.s / 300) + 6,
    // Plan writing: first try plus a few "otra versión".
    armar: 5,
    // Narration characters (all voice calls together).
    voz: 14000 + Math.round(t.s * 2),
  };
}

type Recurso = keyof ReturnType<typeof limites>;
const KJ = (j: string) => `hk:trabajo:${j}`;

/** Adds `n` to a job's counter; false (and no change) if it would pass the budget. */
export async function consumir(t: Trabajo, recurso: Recurso, n: number): Promise<boolean> {
  const tope = limites(t)[recurso];
  const v = await kv.hincrby(KJ(t.j), recurso, n);
  if (v === n) await kv.expire(KJ(t.j), HORAS * 3600);
  if (v > tope) {
    await kv.hincrby(KJ(t.j), recurso, -n);
    return false;
  }
  return true;
}

export async function estadoTrabajo(j: string) {
  return (await kv.hgetall(KJ(j))) ?? {};
}

export async function marcarTrabajo(j: string, campos: Record<string, string | number>) {
  await kv.hset(KJ(j), campos);
  await kv.expire(KJ(j), HORAS * 3600);
}
