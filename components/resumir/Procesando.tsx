"use client";

import { motion } from "motion/react";
import type { Etapa } from "@/lib/resumen/pipeline";
import { resumen, useResumen } from "@/lib/resumen/sesion";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconCheck } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";

const PASOS: { id: Etapa; label: string; detalle: string }[] = [
  { id: "minutos", label: "Reservando tus minutos", detalle: "" },
  { id: "audio", label: "Sacando el audio", detalle: "Tu video no sale de tu teléfono." },
  { id: "transcribir", label: "Escuchando todo el video", detalle: "Transcribimos cada parte en paralelo." },
  { id: "analizar", label: "Encontrando lo más importante", detalle: "Leemos el video completo, de principio a fin." },
  { id: "escribir", label: "Escribiendo el resumen", detalle: "Elegimos los momentos y el guion del narrador." },
  { id: "voz", label: "Grabando la voz del narrador", detalle: "" },
];

export function Procesando() {
  const s = useResumen();
  const a = s.avance;
  const pasos = PASOS.filter((p) => p.id !== "voz" || s.prefs.narrador === "voz");
  const actual = Math.max(0, pasos.findIndex((p) => p.id === a?.etapa));

  return (
    <Card className="flex flex-col gap-5">
      <ol className="flex flex-col gap-4">
        {pasos.map((p, i) => {
          const hecho = i < actual;
          const activo = i === actual;
          return (
            <motion.li
              key={p.id}
              layout
              transition={spring}
              className={"flex gap-3 " + (i > actual ? "opacity-45" : "")}
              aria-current={activo ? "step" : undefined}
            >
              <span
                className={
                  "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold " +
                  (hecho ? "border-accent bg-accent text-accent-ink" : activo ? "border-accent text-accent" : "border-line text-faint")
                }
              >
                {hecho ? <IconCheck size={14} strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {activo && a ? (
                  <ProgressBar
                    value={a.progreso}
                    label={p.label}
                    detail={a.detalle ?? (p.detalle || undefined)}
                    indeterminate={p.id === "minutos" || (p.id === "escribir" && a.progreso < 1)}
                  />
                ) : (
                  <span className={"text-sm font-semibold " + (hecho ? "text-muted" : "")}>{p.label}</span>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
      <p className="t-caption">No cierres esta pantalla ni bloquees el teléfono hasta que termine.</p>
      <Button variant="secondary" block onClick={resumen.cancelar}>
        Cancelar
      </Button>
    </Card>
  );
}
