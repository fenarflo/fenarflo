"use client";

import { memo } from "react";
import { formatoTiempo } from "@/lib/captions/group";
import type { Grupo } from "@/lib/captions/types";

/**
 * One row per on-screen line. Inputs are uncontrolled and commit on blur, so
 * regrouping after an edit never moves text out from under the cursor.
 */
export const LineEditor = memo(function LineEditor({
  grupos,
  activo,
  emojis,
  onSeek,
  onEditar,
}: {
  grupos: Grupo[];
  activo: number;
  emojis: (string | null)[];
  onSeek: (t: number) => void;
  onEditar: (g: Grupo, texto: string) => void;
}) {
  return (
    <ol className="flex flex-col gap-1.5" aria-label="Subtítulos">
      {grupos.map((g, i) => {
        const texto = g.palabras.map((p) => p.text).join(" ");
        const on = i === activo;
        return (
          <li
            key={`${g.desde}-${texto}`}
            className={
              "flex items-center gap-2 rounded-xl border px-1.5 transition-colors duration-150 " +
              (on ? "border-accent/50 bg-accent/5" : "border-transparent")
            }
          >
            <button
              type="button"
              onClick={() => onSeek(g.start)}
              className="min-h-11 w-12 shrink-0 rounded-lg text-left text-xs font-semibold tabular-nums text-faint hover:text-ink"
              aria-label={`Ir a ${formatoTiempo(g.start)}`}
            >
              {formatoTiempo(g.start)}
            </button>
            <input
              defaultValue={texto}
              aria-label={`Subtítulo en ${formatoTiempo(g.start)}`}
              className="min-h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[0.9375rem] outline-none focus:bg-bg"
              onFocus={() => onSeek(g.start)}
              onBlur={(e) => {
                const nuevo = e.target.value.trim();
                if (nuevo && nuevo !== texto) onEditar(g, nuevo);
                else e.target.value = texto;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = texto;
                  e.currentTarget.blur();
                }
              }}
            />
            {emojis[i] && (
              <span className="shrink-0 pr-2 text-muted" style={{ fontFamily: '"Hookly Emoji"' }} aria-hidden="true">
                {emojis[i]}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
});
