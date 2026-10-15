import "server-only";
import { Redis } from "@upstash/redis";

/*
 * Tiny key-value layer over Upstash Redis. Without Redis it falls back to
 * memory: fine for local development, but on serverless memory is
 * per-instance and resets on cold starts, so accounts and payments need Redis.
 */

let redis: Redis | null | undefined;
export function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  if (!redis && process.env.NODE_ENV === "production") {
    console.warn("Hookly: falta UPSTASH_REDIS_REST_URL / TOKEN. Cuentas y pagos se guardan en memoria.");
  }
  return redis;
}

type Valor = string | number;
const mem = new Map<string, { v: unknown; exp?: number }>();
function vivo(k: string) {
  const e = mem.get(k);
  if (e?.exp && e.exp < Date.now()) {
    mem.delete(k);
    return undefined;
  }
  return e;
}

export const kv = {
  async get<T = string>(k: string): Promise<T | null> {
    const r = getRedis();
    if (r) return (await r.get<T>(k)) ?? null;
    return (vivo(k)?.v as T) ?? null;
  },
  async set(k: string, v: Valor, opts?: { ex?: number; nx?: boolean }): Promise<boolean> {
    const r = getRedis();
    if (r) {
      const res = opts?.nx
        ? await r.set(k, v, opts.ex ? { ex: opts.ex, nx: true } : { nx: true })
        : await r.set(k, v, opts?.ex ? { ex: opts.ex } : undefined);
      return res === "OK";
    }
    if (opts?.nx && vivo(k)) return false;
    mem.set(k, { v, exp: opts?.ex ? Date.now() + opts.ex * 1000 : undefined });
    return true;
  },
  async del(k: string) {
    const r = getRedis();
    if (r) await r.del(k);
    else mem.delete(k);
  },
  async hgetall(k: string): Promise<Record<string, string> | null> {
    const r = getRedis();
    if (r) {
      const h = await r.hgetall<Record<string, unknown>>(k);
      if (!h) return null;
      return Object.fromEntries(Object.entries(h).map(([a, b]) => [a, String(b)]));
    }
    const h = vivo(k)?.v as Record<string, string> | undefined;
    return h ? { ...h } : null;
  },
  async hset(k: string, campos: Record<string, Valor>) {
    const r = getRedis();
    if (r) {
      await r.hset(k, campos);
      return;
    }
    const h = (vivo(k)?.v as Record<string, string>) ?? {};
    for (const [a, b] of Object.entries(campos)) h[a] = String(b);
    mem.set(k, { v: h });
  },
  async hincrby(k: string, campo: string, n: number): Promise<number> {
    const r = getRedis();
    if (r) return await r.hincrby(k, campo, n);
    const h = (vivo(k)?.v as Record<string, string>) ?? {};
    const v = Number(h[campo] ?? 0) + n;
    h[campo] = String(v);
    mem.set(k, { v: h, exp: mem.get(k)?.exp });
    return v;
  },
  async incrby(k: string, n: number, ex?: number): Promise<number> {
    const r = getRedis();
    if (r) {
      const p = r.pipeline();
      p.incrby(k, n);
      if (ex) p.expire(k, ex);
      const [v] = await p.exec<[number, number]>();
      return v;
    }
    const e = vivo(k);
    const v = Number(e?.v ?? 0) + n;
    mem.set(k, { v, exp: e?.exp ?? (ex ? Date.now() + ex * 1000 : undefined) });
    return v;
  },
  async expire(k: string, s: number) {
    const r = getRedis();
    if (r) await r.expire(k, s);
    else {
      const e = mem.get(k);
      if (e) e.exp = Date.now() + s * 1000;
    }
  },
};

/*
 * Atomically takes `n` minutes from an account: included minutes first, then
 * bought ones. Returns how many came from each, or null if there aren't enough.
 */
const RESERVAR = `
local incl = tonumber(redis.call('HGET', KEYS[1], 'incl') or '0')
local extra = tonumber(redis.call('HGET', KEYS[1], 'extra') or '0')
local n = tonumber(ARGV[1])
if incl + extra < n then return {-1, incl, extra} end
local a = math.min(incl, n)
redis.call('HINCRBY', KEYS[1], 'incl', -a)
redis.call('HINCRBY', KEYS[1], 'extra', -(n - a))
return {a, n - a}
`;

export async function reservarMinutos(clave: string, n: number): Promise<{ incl: number; extra: number } | null> {
  const r = getRedis();
  if (r) {
    const [a, b] = await r.eval<[number], [number, number]>(RESERVAR, [clave], [n]);
    return a < 0 ? null : { incl: a, extra: b };
  }
  const h = (vivo(clave)?.v as Record<string, string>) ?? {};
  const incl = Number(h.incl ?? 0);
  const extra = Number(h.extra ?? 0);
  if (incl + extra < n) return null;
  const a = Math.min(incl, n);
  h.incl = String(incl - a);
  h.extra = String(extra - (n - a));
  mem.set(clave, { v: h });
  return { incl: a, extra: n - a };
}

/** Records that an event (Stripe event, checkout, invoice) was handled. True the first time only. */
export async function primeraVez(id: string) {
  return kv.set(`hk:hecho:${id}`, 1, { nx: true, ex: 60 * 60 * 24 * 90 });
}
