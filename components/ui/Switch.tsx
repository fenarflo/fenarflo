"use client";

import { motion } from "motion/react";
import { spring } from "@/lib/motion";

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-[0.9375rem] font-semibold">{label}</span>
        {description && <span className="t-caption block">{description}</span>}
      </span>
      <span
        className={
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 " +
          (checked ? "bg-accent" : "bg-line")
        }
      >
        <motion.span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-ink shadow"
          animate={{ x: checked ? 22 : 2 }}
          transition={spring}
        />
      </span>
    </button>
  );
}
