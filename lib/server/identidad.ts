import "server-only";
import type { NextRequest } from "next/server";

/*
 * Hookly has no passwords: a random id in an httpOnly cookie is the account.
 * People move it to another device with their access code (see cuenta.ts).
 */
export const COOKIE = "hk_uid";

export type Identidad = { uid: string; ip: string | null };

export function uidValido(v: string | undefined | null): v is string {
  return !!v && /^[a-f0-9-]{36}$/.test(v);
}

export function identidad(req: NextRequest): { who: Identidad; nueva: boolean } {
  const existente = req.cookies.get(COOKIE)?.value;
  const valida = uidValido(existente);
  const uid = valida ? existente : crypto.randomUUID();
  const ip =
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  return { who: { uid, ip }, nueva: !valida };
}

export function cookieUid(uid: string) {
  return `${COOKIE}=${uid}; Path=/; Max-Age=63072000; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

/** JSON response that never caches and (re)sets the account cookie when needed. */
export function responder<T>(body: T, status: number, uid: string, setCookie: boolean) {
  const res = Response.json(body, { status });
  if (setCookie) res.headers.append("Set-Cookie", cookieUid(uid));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Public origin of this deployment, for Stripe return URLs. */
export function origen(req: NextRequest) {
  const env = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (env && process.env.NODE_ENV === "production") return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}
