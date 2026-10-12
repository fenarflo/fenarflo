"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { Estilo } from "@/lib/estilo";
import { ORDEN_ESTILOS, resolverEstilo } from "@/lib/captions/estilos";
import type { EstiloSubId } from "@/lib/captions/types";
import { snappy, spring } from "@/lib/motion";
import { estiloTexto } from "./CaptionLine";

const MUESTRA_ANCHO = 150;

export function StylePicker({
  value,
  onChange,
  miEstilo,
  personalizado,
}: {
  value: EstiloSubId;
  onChange: (v: EstiloSubId) => void;
  miEstilo: Estilo;
  personalizado: boolean;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label="Estilo de subtítulos" className="grid grid-cols-4 gap-2">
        {ORDEN_ESTILOS.map((id) => {
          const e = resolverEstilo(id, miEstilo);
          const on = id === value;
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              whileTap={{ scale: 0.96 }}
              transition={snappy}
              className={
                "relative flex min-h-11 flex-col items-center gap-2 rounded-2xl border p-2 pb-2.5 transition-colors " +
                (on ? "border-accent bg-accent/10" : "border-line bg-card-2")
              }
            >
              <span className="grid h-14 w-full place-items-center overflow-hidden rounded-xl bg-[#3a3a44]">
                <span
                  style={{
                    ...estiloTexto(e, MUESTRA_ANCHO * 1.5),
                    ...(e.caja ? { background: e.caja.color, padding: "0.05em 0.3em", borderRadius: 4 } : null),
                  }}
                >
                  <span style={{ color: e.resaltado }}>Aa</span>
                </span>
              </span>
              <span className={"text-xs font-semibold " + (on ? "text-ink" : "text-muted")}>{e.nombre}</span>
              {on && (
                <motion.span
                  layoutId="estilo-sel"
                  transition={spring}
                  className="absolute inset-0 rounded-2xl ring-2 ring-accent"
                />
              )}
            </motion.button>
          );
        })}
      </div>
      {value === "mio" && !personalizado && (
        <p className="t-caption mt-2">
          Estás usando los valores por defecto.{" "}
          <Link href="/mi-estilo" className="font-semibold text-accent">
            Configura tu estilo
          </Link>
        </p>
      )}
    </div>
  );
}
