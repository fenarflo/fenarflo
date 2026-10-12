"use client";

import { AnimatePresence, motion } from "motion/react";
import type { GuionOutput, HooksOutput } from "@/lib/ai/schema";
import { CASCADE_STEP, spring } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { IconAlert, IconClock } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { TipoTag } from "./TipoTag";

type Hook = HooksOutput["hooks"][number];

export type GuionEstado =
  | { estado: "cargando" }
  | { estado: "listo"; data: GuionOutput }
  | { estado: "error"; mensaje: string };

function guionComoTexto(g: GuionOutput["guion"]) {
  return `HOOK\n${g.hook}\n\nDESARROLLO\n${g.desarrollo}\n\nCIERRE\n${g.cierre}`;
}

function Seccion({ titulo, rango, texto }: { titulo: string; rango: string; texto: string }) {
  return (
    <div className="border-l-2 border-line pl-3.5">
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-sm font-bold tracking-[0.01em]">{titulo}</h3>
        <span className="t-caption">{rango}</span>
      </div>
      <p className="whitespace-pre-line text-[0.9375rem] leading-[1.55] text-ink/90">{texto}</p>
    </div>
  );
}

export function GuionSheet({
  hook,
  estado,
  onClose,
  onReintentar,
}: {
  hook: Hook | null;
  estado: GuionEstado | undefined;
  onClose: () => void;
  onReintentar: () => void;
}) {
  return (
    <Sheet open={!!hook} onClose={onClose} title="Guion y captions">
      {hook && (
        <div className="flex flex-col gap-5">
          <div>
            <TipoTag tipo={hook.tipo} />
            <p className="mt-2 text-[0.9375rem] text-muted">{hook.texto}</p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {(!estado || estado.estado === "cargando") && (
              <motion.div
                key="cargando"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
                aria-busy="true"
                aria-label="Escribiendo guion"
              >
                <p className="text-sm text-muted">Escribiendo tu guion…</p>
                {[0.9, 1, 0.75, 0.95, 0.6].map((w, i) => (
                  <div key={i} className="skeleton h-4" style={{ width: `${w * 100}%` }} />
                ))}
              </motion.div>
            )}

            {estado?.estado === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="rounded-2xl border border-danger/30 bg-danger/10 p-4"
              >
                <div className="flex gap-2.5 text-sm">
                  <IconAlert size={18} className="mt-0.5 shrink-0 text-danger" />
                  <p>{estado.mensaje}</p>
                </div>
                <Button variant="secondary" className="mt-3" onClick={onReintentar}>
                  Intentar de nuevo
                </Button>
              </motion.div>
            )}

            {estado?.estado === "listo" && (
              <motion.div
                key="listo"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring}
                className="flex flex-col gap-6"
              >
                <section aria-labelledby="g-titulo" className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="g-titulo" className="t-title">
                      Guion
                    </h3>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                      <IconClock size={16} />~{estado.data.guion.duracionSegundos} s
                    </span>
                  </div>
                  <Seccion titulo="Hook" rango="0–3 s" texto={estado.data.guion.hook} />
                  <Seccion titulo="Desarrollo" rango="cuerpo" texto={estado.data.guion.desarrollo} />
                  <Seccion titulo="Cierre" rango="últimos s" texto={estado.data.guion.cierre} />
                  <CopyButton text={guionComoTexto(estado.data.guion)} label="Copiar guion" />
                </section>

                <section aria-labelledby="c-titulo" className="flex flex-col gap-3">
                  <h3 id="c-titulo" className="t-title">
                    Captions
                  </h3>
                  {estado.data.captions.map((c, i) => {
                    const texto = `${c.texto}\n\n${c.hashtags.join(" ")}`;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring, delay: 0.1 + i * CASCADE_STEP }}
                        className="rounded-2xl border border-line bg-bg/60 p-3.5"
                      >
                        <p className="text-[0.9375rem] leading-[1.5]">{c.texto}</p>
                        <p className="mt-2 text-sm font-medium text-accent/90">{c.hashtags.join(" ")}</p>
                        <div className="mt-3">
                          <CopyButton text={texto} />
                        </div>
                      </motion.div>
                    );
                  })}
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Sheet>
  );
}
