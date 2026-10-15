"use client";

import { motion } from "motion/react";
import { spring } from "@/lib/motion";
import { IconAlert } from "./icons";

export function ErrorCard({ mensaje, onClose }: { mensaje: string; onClose?: () => void }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring}
      className="mb-4 flex gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm"
    >
      <IconAlert size={18} className="mt-0.5 shrink-0 text-danger" />
      <p className="flex-1">{mensaje}</p>
      {onClose && (
        <button type="button" onClick={onClose} className="-my-2 min-h-11 px-2 font-semibold text-muted">
          OK
        </button>
      )}
    </motion.div>
  );
}
