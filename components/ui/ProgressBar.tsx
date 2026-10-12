"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

/**
 * Progress that never jumps: a critically damped spring chases the real value,
 * so irregular updates (ffmpeg logs, model chunks) still read as fluid motion.
 */
export function ProgressBar({
  value,
  label,
  detail,
  indeterminate,
}: {
  value: number; // 0..1
  label: string;
  detail?: string;
  indeterminate?: boolean;
}) {
  const reduce = useReducedMotion();
  const v = useSpring(0, { bounce: 0, visualDuration: reduce ? 0.01 : 0.6 });
  useEffect(() => {
    v.set(Math.max(0, Math.min(1, value)));
  }, [value, v]);
  const pct = useTransform(v, (x) => `${Math.round(x * 100)}%`);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        {!indeterminate && (
          <motion.span className="text-sm tabular-nums text-muted">{pct}</motion.span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(value * 100)}
        className="h-2 w-full overflow-hidden rounded-full bg-card-2"
      >
        {indeterminate ? (
          <div className="skeleton h-full w-full !rounded-full" />
        ) : (
          <motion.div
            className="h-full w-full origin-left rounded-full bg-accent"
            style={{ scaleX: v }}
          />
        )}
      </div>
      {detail && <p className="t-caption mt-2">{detail}</p>}
    </div>
  );
}
