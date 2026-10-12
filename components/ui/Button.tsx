"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";
import { snappy } from "@/lib/motion";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "relative inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-2xl px-4 text-[0.9375rem] font-semibold " +
  "touch-manipulation disabled:cursor-not-allowed disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink",
  secondary: "bg-card-2 text-ink border border-line",
  ghost: "bg-transparent text-ink",
};

export type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: Variant;
  block?: boolean;
};

/** Feedback lives on the press (whileTap fires on pointer-down), never on release. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", block, className = "", type = "button", disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97, opacity: 0.88 }}
      transition={snappy}
      className={`${base} ${variants[variant]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
});
