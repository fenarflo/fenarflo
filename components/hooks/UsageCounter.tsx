"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Uso } from "@/lib/ai/schema";
import { snappy } from "@/lib/motion";

export function UsageCounter({ uso, isPro }: { uso: Uso | null; isPro: boolean }) {
  if (isPro) {
    return (
      <span className="inline-flex min-h-8 items-center rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent">
        Pro
      </span>
    );
  }
  const restantes = uso?.restantes;
  const agotado = restantes === 0;
  return (
    <span
      className={
        "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold tabular-nums " +
        (agotado ? "border-danger/40 text-danger" : "border-line text-muted")
      }
      aria-live="polite"
    >
      <span className="relative inline-grid overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={restantes ?? "x"}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={snappy}
            className={agotado ? "" : "text-ink"}
          >
            {restantes ?? "–"}
          </motion.span>
        </AnimatePresence>
      </span>
      de {uso?.limite ?? 3} gratis hoy
    </span>
  );
}
