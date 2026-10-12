"use client";

import { MotionConfig } from "motion/react";

/** "user" makes every motion component honor prefers-reduced-motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
