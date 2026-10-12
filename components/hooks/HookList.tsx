"use client";

import { motion } from "motion/react";
import type { HooksOutput } from "@/lib/ai/schema";
import { CASCADE_STEP, spring } from "@/lib/motion";
import { CopyButton } from "@/components/ui/CopyButton";
import { IconArrowRight } from "@/components/ui/icons";
import { TipoTag } from "./TipoTag";

type Hook = HooksOutput["hooks"][number];

export function HookList({
  hooks,
  tandaId,
  onGuion,
}: {
  hooks: Hook[];
  tandaId: string;
  onGuion: (h: Hook) => void;
}) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Hooks generados">
      {hooks.map((h, i) => (
        <motion.li
          key={`${tandaId}-${i}`}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: i * CASCADE_STEP }}
          className="rounded-[var(--radius-card)] border border-line bg-card p-4"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <TipoTag tipo={h.tipo} />
            <span className="t-caption tabular-nums">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <p className="text-[1.0625rem] font-medium leading-[1.4] tracking-[-0.005em]">{h.texto}</p>
          <div className="mt-3.5 flex gap-2">
            <CopyButton text={h.texto} />
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onGuion(h)}
              className="inline-flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-line bg-card-2 px-3 text-sm font-semibold"
            >
              Ver guion
              <IconArrowRight size={16} />
            </motion.button>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
