"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { estiloMio } from "@/lib/captions/estilos";
import type { Grupo } from "@/lib/captions/types";
import type { Estilo } from "@/lib/estilo";
import { CaptionLine } from "@/components/subtitulos/CaptionLine";

const GRUPO: Grupo = {
  desde: 0,
  start: 0,
  end: 3,
  palabras: ["Así", "se", "ve", "tu", "estilo"].map((text, i) => ({ text, start: i, end: i + 1 })),
};

/** Live sample of the "Mío" caption style; the highlight walks word by word. */
export function EstiloPreview({ estilo }: { estilo: Estilo }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setActiva((a) => (a + 1) % GRUPO.palabras.length), 520);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div
      ref={ref}
      className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.25rem] border border-line"
      style={{
        background:
          "radial-gradient(120% 80% at 20% 10%, #3b3b46 0%, #23232a 45%, #141418 100%)",
      }}
      aria-label="Vista previa de tu estilo de subtítulos"
      role="img"
    >
      {ancho > 0 && (
        <CaptionLine
          grupo={GRUPO}
          activa={reduce ? 2 : activa}
          estilo={{ ...estiloMio(estilo), tamano: estiloMio(estilo).tamano * 1.15 }}
          ancho={ancho}
          emoji={null}
        />
      )}
    </div>
  );
}
