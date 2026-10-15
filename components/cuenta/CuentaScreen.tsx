"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { abrirPago, ponerCuenta, refrescarCuenta, useCuenta } from "@/lib/cuenta";
import { useHydrated } from "@/lib/storage";
import { CASCADE_STEP, spring } from "@/lib/motion";
import { PAQUETES, PLANES, REFERIDO_MINUTOS, precioMXN, type PlanId } from "@/lib/planes";
import { PageHeader } from "@/components/nav/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { IconCheck, IconGift, IconPalette, IconShare } from "@/components/ui/icons";

const AVISOS: Record<string, string> = {
  ok: "Pago recibido. Tus minutos ya están en tu cuenta.",
  pendiente: "Recibimos tu orden. Si pagaste en OXXO, tus minutos llegan en cuanto se confirme el pago (puede tardar unas horas).",
  cancelado: "No se hizo ningún cargo.",
  error: "No pudimos confirmar el pago. Si se hizo el cargo, tus minutos llegarán en unos minutos.",
};

function Saldo() {
  const { cuenta } = useCuenta();
  const [error, setError] = useState<string | null>(null);
  if (!cuenta) return <Card className="skeleton h-40" />;
  const pct = cuenta.minutosMes ? Math.min(1, cuenta.minutosIncluidos / cuenta.minutosMes) : 0;
  const portal = async () => {
    const r = await fetch("/api/pagos/portal", { method: "POST" });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (j.url) window.location.href = j.url;
    else setError(j.error ?? "No pudimos abrir tu suscripción.");
  };
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-label">Tu plan</p>
          <h2 className="t-title mt-0.5">{cuenta.nombrePlan}</h2>
        </div>
        <div className="text-right">
          <p className="font-display text-[2rem] font-bold leading-none tracking-[-0.02em] tabular-nums">{cuenta.minutos}</p>
          <p className="t-caption mt-1">minutos disponibles</p>
        </div>
      </div>
      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-card-2">
          <motion.div
            className="h-full origin-left rounded-full bg-accent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: pct }}
            transition={spring}
          />
        </div>
        <p className="t-caption mt-2">
          {cuenta.minutosIncluidos} de {cuenta.minutosMes} min del mes
          {cuenta.minutosExtra ? ` · ${cuenta.minutosExtra} min extra que no caducan` : ""}
          {cuenta.renueva ? ` · se renueva el ${new Date(cuenta.renueva).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}` : cuenta.plan === "gratis" ? " · se recargan el día 1" : ""}
        </p>
      </div>
      {cuenta.suscrito && (
        <Button variant="secondary" block onClick={portal}>
          Administrar suscripción
        </Button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

function Planes() {
  const { cuenta } = useCuenta();
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activos = cuenta?.pagosActivos ?? true;

  const comprar = async (id: string) => {
    setCargando(id);
    setError(null);
    const e = await abrirPago(id);
    if (e) {
      setError(e);
      setCargando(null);
    }
  };

  const orden: PlanId[] = ["gratis", "estudiante", "pro"];
  return (
    <section className="flex flex-col gap-4" aria-labelledby="planes">
      <h2 id="planes" className="t-title">
        Planes
      </h2>
      {error && <ErrorCard mensaje={error} onClose={() => setError(null)} />}
      {orden.map((id, i) => {
        const p = PLANES[id];
        const actual = cuenta?.plan === id;
        const destacado = id === "pro";
        return (
          <motion.div key={id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * CASCADE_STEP * 2 }}>
            <Card className={destacado ? "border-accent/60" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="t-title">{p.nombre}</h3>
                  <p className="mt-2">
                    <span className="font-display text-[2rem] font-bold tracking-[-0.02em]">{precioMXN(p.precioCentavos)}</span>
                    {p.precioCentavos > 0 && <span className="ml-1.5 text-sm text-muted">al mes</span>}
                  </p>
                </div>
                {actual ? (
                  <span className="rounded-full bg-card-2 px-3 py-1 text-xs font-semibold text-muted">Tu plan</span>
                ) : destacado ? (
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">Creadores</span>
                ) : id === "estudiante" ? (
                  <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">Estudiantes</span>
                ) : null}
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {p.puntos.map((pt) => (
                  <li key={pt} className="flex gap-2.5 text-[0.9375rem]">
                    <IconCheck size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-accent" />
                    {pt}
                  </li>
                ))}
              </ul>
              {id !== "gratis" && !actual && (
                <Button
                  block
                  variant={destacado ? "primary" : "secondary"}
                  className="mt-5"
                  disabled={!activos || !!cargando}
                  onClick={() => comprar(id)}
                >
                  {cargando === id ? <span className="spinner" aria-hidden="true" /> : null}
                  {cuenta?.suscrito ? "Cambiar a este plan" : `Elegir ${p.nombre}`}
                </Button>
              )}
            </Card>
          </motion.div>
        );
      })}

      <h2 className="t-title mt-2">Minutos extra</h2>
      <div className="grid gap-3">
        {Object.values(PAQUETES).map((q) => (
          <Card key={q.id} className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{q.nombre}</h3>
              <p className="t-caption mt-0.5">{q.detalle}</p>
            </div>
            <Button className="shrink-0" variant="secondary" disabled={!activos || !!cargando} onClick={() => comprar(q.id)}>
              {cargando === q.id ? <span className="spinner" aria-hidden="true" /> : null}
              {precioMXN(q.precioCentavos)}
            </Button>
          </Card>
        ))}
      </div>
      {!activos && <p className="t-caption text-center">Los pagos se activan en cuanto el servidor tenga su llave de Stripe.</p>}
      <p className="t-caption px-2 text-center">
        Pagos seguros con Stripe: tarjeta, Apple Pay o Google Pay. Los paquetes también se pueden pagar en OXXO. Cancela cuando quieras.
      </p>
    </section>
  );
}

function Invitar() {
  const { cuenta } = useCuenta();
  const hidratado = useHydrated();
  if (!cuenta) return null;
  const origen = hidratado ? window.location.origin : "";
  const link = `${origen}/?ref=${cuenta.ref}`;
  const compartir = () =>
    navigator
      .share?.({ title: "Hookly", text: "Resume videos largos con un narrador en segundos. Te dejo mi link:", url: link })
      .catch(() => {});
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card-2 text-accent">
          <IconGift size={20} />
        </span>
        <div>
          <h2 className="font-semibold">Invita y gana minutos</h2>
          <p className="text-sm text-muted">
            Cuando alguien que invitaste hace su primer pago, tú ganas {REFERIDO_MINUTOS.invita} min y esa persona {REFERIDO_MINUTOS.invitado}.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{link}</span>
        <CopyButton text={link} compact />
      </div>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button variant="secondary" block onClick={compartir}>
          <IconShare size={18} />
          Compartir mi link
        </Button>
      )}
    </Card>
  );
}

function OtroDispositivo() {
  const { cuenta } = useCuenta();
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<{ ok?: boolean; msg?: string }>({});
  if (!cuenta) return null;
  const vincular = async () => {
    setEstado({});
    const r = await fetch("/api/cuenta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "vincular", codigo }),
    });
    const j = (await r.json().catch(() => ({}))) as { cuenta?: Parameters<typeof ponerCuenta>[0]; error?: string };
    if (j.cuenta) {
      ponerCuenta(j.cuenta);
      setCodigo("");
      setEstado({ ok: true, msg: "Listo, ya estás usando esa cuenta en este dispositivo." });
      refrescarCuenta();
    } else setEstado({ ok: false, msg: j.error ?? "No pudimos usar ese código." });
  };
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">Tu cuenta en otro dispositivo</h2>
      <p className="text-sm text-muted">
        Este es tu código de acceso. Guárdalo: con él recuperas tu plan y tus minutos en otro teléfono o computadora. No lo compartas.
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
        <span className="min-w-0 flex-1 font-mono text-[0.9375rem] tracking-wider">{cuenta.codigo}</span>
        <CopyButton text={cuenta.codigo} compact />
      </div>
      <label className="mt-1 flex flex-col gap-2">
        <span className="t-label">¿Ya tienes una cuenta? Escribe su código</span>
        <div className="flex gap-2">
          <input
            className="field font-mono uppercase"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <Button variant="secondary" className="shrink-0" disabled={codigo.replace(/[^a-z0-9]/gi, "").length !== 12} onClick={vincular}>
            Usar
          </Button>
        </div>
      </label>
      {estado.msg && <p className={"text-sm " + (estado.ok ? "text-accent" : "text-danger")}>{estado.msg}</p>}
    </Card>
  );
}

/* ?pago=… from Stripe's return, read once per visit. */
let avisoLeido: string | null | undefined;
function leerAviso() {
  if (avisoLeido === undefined) avisoLeido = new URLSearchParams(window.location.search).get("pago");
  return avisoLeido;
}

export function CuentaScreen() {
  const hidratado = useHydrated();
  const [cerrado, setCerrado] = useState(false);
  const p = hidratado ? leerAviso() : null;
  const aviso = !cerrado && p && AVISOS[p] ? p : null;
  useEffect(() => {
    if (!aviso) return;
    refrescarCuenta();
    window.history.replaceState(null, "", "/cuenta");
  }, [aviso]);
  useEffect(
    () => () => {
      avisoLeido = undefined;
    },
    [],
  );

  return (
    <>
      <PageHeader title="Cuenta" subtitle="Tus minutos, tu plan y tu estilo." />
      <div className="flex flex-col gap-5">
        <AnimatePresence>
          {aviso && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              role="status"
              className={
                "flex gap-2.5 rounded-2xl border p-4 text-sm " +
                (aviso === "ok" ? "border-accent/40 bg-accent/10" : "border-line bg-card-2")
              }
            >
              {aviso === "ok" && <IconCheck size={18} className="mt-0.5 shrink-0 text-accent" />}
              <p className="flex-1">{AVISOS[aviso]}</p>
              <button type="button" onClick={() => setCerrado(true)} className="-my-2 min-h-11 px-2 font-semibold text-muted">
                OK
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <Saldo />
        <Link href="/mi-estilo" className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-line bg-card px-4">
          <IconPalette size={20} className="text-accent" />
          <span className="flex-1 font-semibold">Mi estilo</span>
          <span className="text-sm text-muted">Colores, fuente y tono</span>
        </Link>
        <Planes />
        <Invitar />
        <OtroDispositivo />
        <p className="t-caption px-2 text-center">
          Los minutos cuentan la duración del video que subes, no la del resumen. Hookly no promete vistas ni seguidores: te
          ayuda a sacar lo mejor de tus videos más rápido.
        </p>
      </div>
    </>
  );
}
