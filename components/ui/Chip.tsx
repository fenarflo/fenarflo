"use client";

import { motion } from "motion/react";
import { snappy } from "@/lib/motion";

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={snappy}
      className={
        "min-h-11 shrink-0 touch-manipulation rounded-full border px-4 text-sm font-medium transition-colors duration-150 " +
        (selected
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-card-2 text-ink hover:border-faint")
      }
    >
      {children}
    </motion.button>
  );
}
