"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ErrorResponse,
  GuionResponse,
  HooksOutput,
  HooksResponse,
  Plataforma,
  Uso,
} from "@/lib/ai/schema";
import { useEstilo } from "@/lib/estilo";
import { useHistorial, type EntradaHistorial } from "@/lib/historial";
import { spring } from "@/lib/motion";
import { usePlan } from "@/lib/cuenta";
import { usePersistentState } from "@/lib/storage";
import { PageHeader } from "@/components/nav/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconAlert, IconSparkle } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { GuionSheet, type GuionEstado } from "./GuionSheet";
import { HookList } from "./HookList";
import { NICHOS, PLATAFORMA_OPCIONES } from "./tipos";
import { UsageCounter } from "./UsageCounter";

type Hook = HooksOutput["hooks"][number];
type Contexto = { idea: string; nicho?: string; plataforma: Plataforma };
type Tanda = { id: string; hooks: Hook[]; ctx: Contexto };

const MAX_IDEA = 500;

async function postGenerar<T>(body: unknown): Promise<{ ok: true; data: T } | { ok: false; err: ErrorResponse }> {
  try {
    const res = await fetch("/api/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { ok: false, err: data ?? { error: "El servidor no respondió. Intenta de nuevo." } };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, err: { error: "Sin conexión. Revisa tu internet e intenta de nuevo." } };
  }
}

export function HooksScreen() {
  const [estilo] = useEstilo();
  const { isPro } = usePlan();
  const historial = useHistorial();
  const [prefs, setPrefs] = usePersistentState<{ nicho?: string; plataforma: Plataforma }>("prefs", {
    plataforma: "tiktok",
  });

  const [idea, setIdea] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [uso, setUso] = useState<Uso | null>(null);
  const [tanda, setTanda] = useState<Tanda | null>(null);
  const [hookAbierto, setHookAbierto] = useState<Hook | null>(null);
  const [guiones, setGuiones] = useState<Record<string, GuionEstado>>({});
  const resultadosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/generar", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { uso?: Uso }) => d.uso && setUso(d.uso))
      .catch(() => {});
  }, []);

  const sinGeneraciones = uso?.restantes === 0;
  const ideaLimpia = idea.trim();

  const generar = async () => {
    if (cargando || ideaLimpia.length < 3) return;
    setCargando(true);
    setError(null);
    const ctx: Contexto = { idea: ideaLimpia, nicho: prefs.nicho, plataforma: prefs.plataforma };
    const r = await postGenerar<HooksResponse>({
      tipo: "hooks",
      ...ctx,
      estilo: { tono: estilo.tono, ejemplos: estilo.ejemplos.filter((e) => e.trim()) },
    });
    setCargando(false);
    if (!r.ok) {
      setError(r.err);
      if (r.err.uso) setUso(r.err.uso);
      return;
    }
    setUso(r.data.uso);
    const nueva = { id: crypto.randomUUID(), hooks: r.data.hooks, ctx };
    setTanda(nueva);
    setGuiones({});
    historial.agregar({ ...ctx, hooks: r.data.hooks });
    navigator.vibrate?.(10);
    requestAnimationFrame(() =>
      resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const pedirGuion = useCallback(
    async (h: Hook, ctx: Contexto) => {
      setGuiones((g) => ({ ...g, [h.texto]: { estado: "cargando" } }));
      const r = await postGenerar<GuionResponse>({
        tipo: "guion",
        ...ctx,
        hook: h.texto,
        hookTipo: h.tipo,
        estilo: { tono: estilo.tono, ejemplos: estilo.ejemplos.filter((e) => e.trim()) },
      });
      setGuiones((g) => ({
        ...g,
        [h.texto]: r.ok
          ? { estado: "listo", data: { guion: r.data.guion, captions: r.data.captions } }
          : { estado: "error", mensaje: r.err.error },
      }));
    },
    [estilo.tono, estilo.ejemplos],
  );

  const abrirGuion = (h: Hook) => {
    if (!tanda) return;
    setHookAbierto(h);
    const actual = guiones[h.texto];
    if (!actual || actual.estado === "error") pedirGuion(h, tanda.ctx);
  };

  const restaurar = (e: EntradaHistorial) => {
    setIdea(e.idea);
    setPrefs({ nicho: e.nicho, plataforma: e.plataforma });
    setTanda({ id: e.id, hooks: e.hooks, ctx: { idea: e.idea, nicho: e.nicho, plataforma: e.plataforma } });
    setGuiones({});
    requestAnimationFrame(() =>
      resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <>
      <PageHeader
        title="Hooks"
        subtitle="Aperturas para tus primeros 3 segundos, con guion y captions."
        aside={<UsageCounter uso={uso} isPro={isPro} />}
      />

      <Card className="flex flex-col gap-5">
        <div>
          <label htmlFor="idea" className="t-label mb-2 block">
            Tu idea de video
          </label>
          <textarea
            id="idea"
            className="field min-h-28 resize-none"
            placeholder="Ej. 3 errores que cometí al ahorrar mi primer sueldo"
            maxLength={MAX_IDEA}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generar();
            }}
          />
          <div className="mt-1.5 flex justify-end">
            <span className="t-caption tabular-nums">
              {idea.length}/{MAX_IDEA}
            </span>
          </div>
        </div>

        <div>
          <span className="t-label mb-2 block" id="nicho-label">
            Nicho
          </span>
          <div
            role="group"
            aria-labelledby="nicho-label"
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          >
            {NICHOS.map((n) => (
              <Chip
                key={n}
                selected={prefs.nicho === n}
                onClick={() => setPrefs((p) => ({ ...p, nicho: p.nicho === n ? undefined : n }))}
              >
                {n}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <span className="t-label mb-2 block">Plataforma</span>
          <Segmented
            label="Plataforma"
            value={prefs.plataforma}
            onChange={(v) => setPrefs((p) => ({ ...p, plataforma: v }))}
            options={PLATAFORMA_OPCIONES}
          />
        </div>

        <Button
          block
          className="min-h-13 text-base"
          onClick={generar}
          disabled={cargando || ideaLimpia.length < 3 || sinGeneraciones}
          aria-busy={cargando}
        >
          {cargando ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Generando hooks…
            </>
          ) : (
            <>
              <IconSparkle size={19} />
              Generar hooks
            </>
          )}
        </Button>

        {sinGeneraciones && (
          <p className="-mt-2 text-center text-sm text-muted">
            Usaste tus generaciones de hoy.{" "}
            <Link href="/cuenta" className="font-semibold text-accent underline-offset-4 hover:underline">
              Ver plan Pro
            </Link>
          </p>
        )}
      </Card>

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring}
            className="mt-4 flex gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm"
          >
            <IconAlert size={18} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p>{error.error}</p>
              {error.codigo === "limite" && (
                <Link href="/cuenta" className="mt-1 inline-block font-semibold text-accent">
                  Conoce el plan Pro
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={resultadosRef} className="scroll-mt-4">
        {cargando && !tanda && (
          <div className="mt-6 flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[var(--radius-card)] border border-line bg-card p-4">
                <div className="skeleton mb-3 h-5 w-20" />
                <div className="skeleton mb-2 h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {tanda && (
          <section className={"mt-8 transition-opacity duration-200 " + (cargando ? "opacity-40" : "")}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="t-title">Tus hooks</h2>
              <span className="t-caption truncate">
                {PLATAFORMA_OPCIONES.find((p) => p.id === tanda.ctx.plataforma)?.label}
                {tanda.ctx.nicho ? ` · ${tanda.ctx.nicho}` : ""}
              </span>
            </div>
            <HookList hooks={tanda.hooks} tandaId={tanda.id} onGuion={abrirGuion} />
          </section>
        )}
      </div>

      {historial.loaded && historial.items.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="t-title">Recientes</h2>
            <button
              type="button"
              onClick={historial.borrar}
              className="min-h-11 px-2 text-sm font-medium text-faint hover:text-muted"
            >
              Borrar
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {historial.items.slice(0, 5).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => restaurar(e)}
                  className={
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors " +
                    (tanda?.id === e.id ? "border-accent/50" : "border-line hover:border-faint")
                  }
                >
                  <span className="line-clamp-1 text-[0.9375rem]">{e.idea}</span>
                  <span className="t-caption shrink-0">
                    {new Date(e.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="t-caption mt-10 text-center">
        Los hooks son sugerencias creativas. Ningún texto garantiza vistas ni resultados.
      </p>

      <GuionSheet
        hook={hookAbierto}
        estado={hookAbierto ? guiones[hookAbierto.texto] : undefined}
        onClose={() => setHookAbierto(null)}
        onReintentar={() => hookAbierto && tanda && pedirGuion(hookAbierto, tanda.ctx)}
      />
    </>
  );
}
