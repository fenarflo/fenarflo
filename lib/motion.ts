import type { Transition } from "motion/react";

/*
 * Shared springs. Critically damped (bounce 0) by default: graceful and
 * non-distracting. A little bounce only where a gesture carried momentum.
 * visualDuration ~ Apple's "response".
 */
export const spring: Transition = { type: "spring", bounce: 0, visualDuration: 0.4 };
export const snappy: Transition = { type: "spring", bounce: 0, visualDuration: 0.25 };
export const sheetSpring: Transition = { type: "spring", bounce: 0.12, visualDuration: 0.32 };

/** Short cross-fade used instead of movement when reduced motion is on. */
export const fade: Transition = { duration: 0.18, ease: "easeOut" };

/** Delay between items in a cascade (hooks list). */
export const CASCADE_STEP = 0.045;

/**
 * Apple's momentum projection (Designing Fluid Interfaces): where a flick
 * would come to rest. Velocity in px/s.
 */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
