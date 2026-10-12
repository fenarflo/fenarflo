"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";
import type { EstiloSub } from "@/lib/captions/estilos";
import { POSICION_Y } from "@/lib/captions/estilos";
import type { Grupo } from "@/lib/captions/types";

function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** CSS that mirrors what libass draws, scaled to the preview width. */
export function estiloTexto(e: EstiloSub, ancho: number): CSSProperties {
  const css: CSSProperties = {
    fontFamily: e.fuenteCss,
    fontWeight: e.peso,
    fontSize: e.tamano * ancho,
    lineHeight: 1.18,
    color: e.texto,
    letterSpacing: e.id === "bold" || e.id === "mio" ? "-0.01em" : "0",
    textTransform: e.mayusculas ? "uppercase" : "none",
  };
  if (e.contorno) {
    css.WebkitTextStroke = `${e.contorno.grosor * ancho * 2}px ${e.contorno.color}`;
    css.paintOrder = "stroke fill";
  }
  if (e.sombra) css.textShadow = `0 ${0.004 * ancho}px ${0.014 * ancho}px rgba(0,0,0,0.6)`;
  return css;
}

export function CaptionLine({
  grupo,
  activa,
  estilo,
  ancho,
  emoji,
}: {
  grupo: Grupo;
  activa: number;
  estilo: EstiloSub;
  ancho: number;
  emoji: string | null;
}) {
  const caja = estilo.caja;
  const pad = caja ? caja.padding * ancho : 0;
  return (
    <div
      className="pointer-events-none absolute inset-x-[8%] text-center"
      style={{ bottom: `${POSICION_Y * 100}%` }}
      aria-hidden="true"
    >
      <span
        style={{
          ...estiloTexto(estilo, ancho),
          ...(caja
            ? {
                background: rgba(caja.color, caja.opacidad),
                padding: `${pad * 0.5}px ${pad}px`,
                borderRadius: ancho * 0.012,
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }
            : null),
        }}
      >
        {grupo.palabras.map((p, i) => {
          const on = i === activa;
          return (
            <span key={`${grupo.start}-${i}`}>
              {i > 0 && " "}
              <motion.span
                className="inline-block"
                initial={false}
                animate={{ scale: on ? estilo.pop : 1, opacity: on ? 1 : estilo.inactivo }}
                transition={{ type: "spring", bounce: 0.3, visualDuration: 0.16 }}
                style={{ color: on ? estilo.resaltado : estilo.texto }}
              >
                {p.text}
              </motion.span>
            </span>
          );
        })}
        {emoji && (
          <span style={{ fontFamily: '"Hookly Emoji"', fontWeight: 400, marginLeft: "0.25em", WebkitTextStroke: 0 }}>
            {emoji}
          </span>
        )}
      </span>
    </div>
  );
}
