"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { snappy } from "@/lib/motion";
import { IconCheck, IconCopy } from "./icons";

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Fallback for browsers without async clipboard permission.
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({
  text,
  label = "Copiar",
  compact,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copiar(text);
    setEstado(ok ? "ok" : "error");
    if (ok) navigator.vibrate?.(8);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setEstado("idle"), 1600);
  };

  const ok = estado === "ok";
  const visible = ok ? "Copiado" : estado === "error" ? "No se pudo" : label;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={snappy}
      aria-label={compact ? `${label}: ${text.slice(0, 60)}` : undefined}
      className={
        "relative inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-3 text-sm font-semibold transition-colors duration-200 " +
        (ok ? "border-accent bg-accent text-accent-ink" : "border-line bg-card-2 text-ink")
      }
    >
      <span className="relative grid h-5 w-5 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={ok ? "check" : "copy"}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.35, visualDuration: 0.28 }}
            className="absolute inset-0 grid place-items-center"
          >
            {ok ? <IconCheck size={18} strokeWidth={2.4} /> : <IconCopy size={18} />}
          </motion.span>
        </AnimatePresence>
      </span>
      {!compact && <span>{visible}</span>}
      <span className="sr-only" aria-live="polite">
        {ok ? "Copiado al portapapeles" : ""}
      </span>
    </motion.button>
  );
}
