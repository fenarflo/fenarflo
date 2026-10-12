"use client";

import { motion } from "motion/react";
import { snappy } from "@/lib/motion";
import { IconCheck } from "@/components/ui/icons";

function luminancia(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function ColorField({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
}) {
  const v = value.toUpperCase();
  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-center justify-between">
        <span className="text-[0.9375rem] font-semibold">{label}</span>
        <span className="t-caption tabular-nums">{v}</span>
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((c) => {
          const on = c.toUpperCase() === v;
          return (
            <motion.button
              key={c}
              type="button"
              whileTap={{ scale: 0.9 }}
              transition={snappy}
              onClick={() => onChange(c)}
              aria-label={`${label}: ${c}`}
              aria-pressed={on}
              className={
                "grid h-11 w-11 place-items-center rounded-full border-2 transition-colors " +
                (on ? "border-ink" : "border-line")
              }
              style={{ background: c }}
            >
              {on && (
                <IconCheck
                  size={18}
                  strokeWidth={2.6}
                  style={{ color: luminancia(c) > 0.6 ? "#0E0E10" : "#F4F4F5" }}
                />
              )}
            </motion.button>
          );
        })}
        <label
          className="relative grid h-11 min-w-11 cursor-pointer place-items-center rounded-full border-2 border-dashed border-line px-3 text-xs font-semibold text-muted hover:text-ink"
          title="Elegir otro color"
        >
          Otro
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label}: elegir otro color`}
          />
        </label>
      </div>
    </fieldset>
  );
}
