"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { CuentaPublica } from "@/lib/server/cuenta";

/* The account lives on the server; this keeps one shared copy for every screen. */

export type Servicios = { ia: boolean; transcripcion: boolean; voz: boolean };
type Estado = { cuenta: CuentaPublica | null; servicios: Servicios | null; error: boolean };

let estado: Estado = { cuenta: null, servicios: null, error: false };
const subs = new Set<() => void>();
let enCurso: Promise<void> | null = null;

function emitir(nuevo: Partial<Estado>) {
  estado = { ...estado, ...nuevo };
  subs.forEach((f) => f());
}

export function refrescarCuenta() {
  enCurso ??= fetch("/api/cuenta", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { cuenta: CuentaPublica; servicios: Servicios }) => emitir({ cuenta: j.cuenta, servicios: j.servicios, error: false }))
    .catch(() => emitir({ error: true }))
    .finally(() => {
      enCurso = null;
    });
  return enCurso;
}

export function ponerCuenta(c: CuentaPublica) {
  emitir({ cuenta: c });
}

let pedida = false;
export function useCuenta() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => estado,
    () => estado,
  );
  useEffect(() => {
    if (pedida) return;
    pedida = true;
    // Remember who invited this person (?ref=CODE) before loading the account.
    const ref = new URLSearchParams(window.location.search).get("ref");
    const listo = ref
      ? fetch("/api/cuenta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "referido", ref }),
        }).catch(() => {})
      : Promise.resolve();
    listo.then(() => refrescarCuenta());
  }, []);
  return { ...s, refrescar: refrescarCuenta };
}

/** Paid plan: no watermark, 1080p. */
export function usePlan() {
  const { cuenta } = useCuenta();
  return { isPro: !!cuenta && cuenta.plan !== "gratis", loaded: !!cuenta };
}

export async function abrirPago(producto: string): Promise<string | null> {
  const r = await fetch("/api/pagos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ producto }),
  });
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (j.url) {
    window.location.href = j.url;
    return null;
  }
  return j.error ?? "No pudimos abrir la página de pago.";
}
