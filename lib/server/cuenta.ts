import "server-only";
import { GRATIS_POR_IP_MES, PAQUETES, PLANES, REFERIDO_MINUTOS, esPlan, type PaqueteId, type PlanId } from "@/lib/planes";
import { kv, reservarMinutos } from "./kv";

/*
 * Account = one Redis hash per person:
 *   plan     gratis | estudiante | pro
 *   incl     included minutes left this period (reset monthly / on each paid invoice)
 *   extra    bought minutes left (never expire)
 *   periodo  YYYY-MM of the last free-plan reset
 *   codigo   secret access code to use the account on another device
 *   ref      public invite code
 *   refDe    uid of whoever invited this person
 *   customer / sub   Stripe ids
 *   pagos    number of payments (referral reward on the first one)
 */

export type Cuenta = {
  uid: string;
  plan: PlanId;
  incl: number;
  extra: number;
  periodo: string;
  codigo: string;
  ref: string;
  refDe?: string;
  customer?: string;
  sub?: string;
  subEstado?: string;
  renueva?: number;
  pagos: number;
};

export type CuentaPublica = {
  plan: PlanId;
  nombrePlan: string;
  minutos: number;
  minutosIncluidos: number;
  minutosExtra: number;
  minutosMes: number;
  marcaDeAgua: boolean;
  maxResumen: number;
  codigo: string;
  ref: string;
  renueva?: number;
  suscrito: boolean;
  pagosActivos: boolean;
};

const K = (uid: string) => `hk:cuenta:${uid}`;
const KCodigo = (c: string) => `hk:codigo:${c}`;
const KRef = (r: string) => `hk:ref:${r}`;

function mesMX() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(
    new Date(),
  );
}

// No 0/O, 1/I/L: codes get typed on phones.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function aleatorio(n: number) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("");
}
export function normalizarCodigo(c: string) {
  return c.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function leer(uid: string, h: Record<string, string>): Cuenta {
  const plan = (h.plan === "estudiante" || h.plan === "pro" ? h.plan : "gratis") as PlanId;
  return {
    uid,
    plan,
    incl: Math.max(0, Number(h.incl ?? 0)),
    extra: Math.max(0, Number(h.extra ?? 0)),
    periodo: h.periodo ?? "",
    codigo: h.codigo ?? "",
    ref: h.ref ?? "",
    refDe: h.refDe || undefined,
    customer: h.customer || undefined,
    sub: h.sub || undefined,
    subEstado: h.subEstado || undefined,
    renueva: h.renueva ? Number(h.renueva) : undefined,
    pagos: Number(h.pagos ?? 0),
  };
}

export async function obtenerCuenta(uid: string): Promise<Cuenta> {
  let h = await kv.hgetall(K(uid));
  if (!h || !h.codigo) {
    const codigo = aleatorio(12);
    const ref = aleatorio(6);
    const nueva = { plan: "gratis", incl: PLANES.gratis.minutosMes, extra: 0, periodo: mesMX(), codigo, ref, pagos: 0, creado: Date.now() };
    await Promise.all([kv.hset(K(uid), { ...nueva, ...(h ?? {}) }), kv.set(KCodigo(codigo), uid), kv.set(KRef(ref), uid)]);
    h = { ...Object.fromEntries(Object.entries(nueva).map(([a, b]) => [a, String(b)])), ...(h ?? {}) };
  }
  const c = leer(uid, h);
  // Free minutes refill on the 1st of each month (Mexico City time).
  const mes = mesMX();
  if (c.plan === "gratis" && c.periodo !== mes) {
    await kv.hset(K(uid), { periodo: mes, incl: PLANES.gratis.minutosMes });
    c.periodo = mes;
    c.incl = PLANES.gratis.minutosMes;
  }
  return c;
}

export function pagosConfigurados() {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function publica(c: Cuenta): CuentaPublica {
  const p = PLANES[c.plan];
  return {
    plan: c.plan,
    nombrePlan: p.nombre,
    minutos: c.incl + c.extra,
    minutosIncluidos: c.incl,
    minutosExtra: c.extra,
    minutosMes: p.minutosMes,
    marcaDeAgua: p.marcaDeAgua,
    maxResumen: p.maxResumen,
    codigo: c.codigo.replace(/(.{4})(?=.)/g, "$1-"),
    ref: c.ref,
    renueva: c.renueva,
    suscrito: !!c.sub && c.plan !== "gratis",
    pagosActivos: pagosConfigurados(),
  };
}

/** Access code → uid, to open the same account on another device. */
export async function uidPorCodigo(codigo: string) {
  const c = normalizarCodigo(codigo);
  if (c.length !== 12) return null;
  return kv.get<string>(KCodigo(c));
}

/** Stores who invited this person (once, never yourself, only before any payment). */
export async function guardarReferido(uid: string, ref: string) {
  const r = normalizarCodigo(ref);
  if (r.length !== 6) return false;
  const de = await kv.get<string>(KRef(r));
  const c = await obtenerCuenta(uid);
  if (!de || de === uid || c.refDe || c.pagos > 0) return false;
  await kv.hset(K(uid), { refDe: de });
  return true;
}

export class SinMinutos extends Error {
  constructor(public codigo: "saldo" | "ip") {
    super(codigo);
  }
}

export type Reserva = { incl: number; extra: number };

/** Takes the minutes a job needs up front; they're returned if the job fails early. */
export async function reservar(c: Cuenta, ip: string | null, minutos: number): Promise<Reserva> {
  if (c.plan === "gratis" && ip && c.extra < minutos) {
    const k = `hk:ipmin:${mesMX()}:${ip}`;
    const usados = Number((await kv.get<number>(k)) ?? 0);
    if (usados + minutos > GRATIS_POR_IP_MES) throw new SinMinutos("ip");
  }
  const r = await reservarMinutos(K(c.uid), minutos);
  if (!r) throw new SinMinutos("saldo");
  if (c.plan === "gratis" && ip && r.incl > 0) await kv.incrby(`hk:ipmin:${mesMX()}:${ip}`, r.incl, 60 * 60 * 24 * 40);
  return r;
}

export async function devolver(uid: string, r: Reserva) {
  if (r.incl) await kv.hincrby(K(uid), "incl", r.incl);
  if (r.extra) await kv.hincrby(K(uid), "extra", r.extra);
}

/* ---------- Called from Stripe (webhook or the return page) ---------- */

/** A paid subscription invoice: set the plan and refill its monthly minutes. */
export async function renovarPlan(
  uid: string,
  plan: PlanId,
  datos: { customer?: string; sub?: string; renueva?: number },
) {
  if (!esPlan(plan)) return;
  await obtenerCuenta(uid);
  await kv.hset(K(uid), {
    plan,
    incl: PLANES[plan].minutosMes,
    subEstado: "active",
    ...(datos.customer ? { customer: datos.customer } : {}),
    ...(datos.sub ? { sub: datos.sub } : {}),
    ...(datos.renueva ? { renueva: datos.renueva } : {}),
  });
}

export async function vincularStripe(uid: string, datos: { customer?: string; sub?: string }) {
  const campos: Record<string, string> = {};
  if (datos.customer) campos.customer = datos.customer;
  if (datos.sub) campos.sub = datos.sub;
  if (Object.keys(campos).length) await kv.hset(K(uid), campos);
}

/** Subscription ended: back to free. Minutes already bought stay. */
export async function terminarPlan(uid: string, sub: string) {
  const c = await obtenerCuenta(uid);
  if (c.sub && c.sub !== sub) return; // an older subscription; a newer one is active
  await kv.hset(K(uid), {
    plan: "gratis",
    incl: Math.min(c.incl, PLANES.gratis.minutosMes),
    periodo: mesMX(),
    sub: "",
    subEstado: "canceled",
    renueva: "",
  });
}

export async function acreditarPaquete(uid: string, paquete: PaqueteId) {
  await obtenerCuenta(uid);
  await kv.hincrby(K(uid), "extra", PAQUETES[paquete].minutos);
}

/** Counts a payment; on the first one, rewards the person who invited them. */
export async function registrarPago(uid: string) {
  const n = await kv.hincrby(K(uid), "pagos", 1);
  if (n !== 1) return;
  const c = await obtenerCuenta(uid);
  if (!c.refDe) return;
  await Promise.all([
    kv.hincrby(K(c.refDe), "extra", REFERIDO_MINUTOS.invita),
    kv.hincrby(K(uid), "extra", REFERIDO_MINUTOS.invitado),
  ]);
}
