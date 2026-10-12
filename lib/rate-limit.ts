import { Redis } from "@upstash/redis";
import type { Uso } from "@/lib/ai/schema";

/** Free generations of hooks per person per day (Mexico City calendar day). */
export const LIMITE_HOOKS_DIA = 3;
/** Hidden safety cap for scripts, so "Ver guion" can't be used to run up costs. */
export const LIMITE_GUIONES_DIA = 15;
/*
 * Per-IP ceiling. Mobile carriers put many people behind one IP (CGNAT), so
 * this is deliberately generous: it only stops someone clearing cookies in a loop.
 */
const FACTOR_IP = 10;

export type Accion = "hooks" | "guion";
export type Identidad = { uid: string; ip: string | null };

const LIMITES: Record<Accion, number> = { hooks: LIMITE_HOOKS_DIA, guion: LIMITE_GUIONES_DIA };

function hoyMX() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

let redis: Redis | null | undefined;
function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/*
 * Without Redis we fall back to memory. On serverless this is per-instance and
 * resets on cold starts: fine for local development, not a real limit.
 */
const memoria = new Map<string, number>();

function claves(accion: Accion, who: Identidad) {
  const dia = hoyMX();
  return {
    uid: `hookly:${accion}:${dia}:u:${who.uid}`,
    ip: who.ip ? `hookly:${accion}:${dia}:ip:${who.ip}` : null,
  };
}

async function leer(keys: string[]): Promise<number[]> {
  const r = getRedis();
  if (r) {
    const vals = await r.mget<(number | null)[]>(...keys);
    return vals.map((v) => Number(v ?? 0));
  }
  return keys.map((k) => memoria.get(k) ?? 0);
}

async function sumar(keys: string[]) {
  const r = getRedis();
  if (r) {
    const p = r.pipeline();
    for (const k of keys) {
      p.incr(k);
      p.expire(k, 60 * 60 * 36);
    }
    await p.exec();
    return;
  }
  for (const k of keys) memoria.set(k, (memoria.get(k) ?? 0) + 1);
}

export function limiteDesactivado() {
  return process.env.HOOKLY_SIN_LIMITE === "1";
}

export async function consultarUso(accion: Accion, who: Identidad): Promise<Uso & { bloqueado: boolean }> {
  const limite = LIMITES[accion];
  if (limiteDesactivado()) return { usados: 0, limite, restantes: limite, bloqueado: false };
  const k = claves(accion, who);
  const [usados, porIp = 0] = await leer(k.ip ? [k.uid, k.ip] : [k.uid]);
  const bloqueado = usados >= limite || porIp >= limite * FACTOR_IP;
  return { usados, limite, restantes: bloqueado ? 0 : Math.max(0, limite - usados), bloqueado };
}

export async function registrarUso(accion: Accion, who: Identidad): Promise<Uso> {
  const limite = LIMITES[accion];
  if (limiteDesactivado()) return { usados: 0, limite, restantes: limite };
  const k = claves(accion, who);
  await sumar(k.ip ? [k.uid, k.ip] : [k.uid]);
  return publico(await consultarUso(accion, who));
}

/** Strips internal fields before sending usage to the browser. */
export function publico(u: Uso): Uso {
  return { usados: u.usados, limite: u.limite, restantes: u.restantes };
}
