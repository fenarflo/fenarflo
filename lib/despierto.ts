"use client";

/* Keeps the screen on during long jobs (phones throttle or pause hidden pages). */
type Lock = { release: () => Promise<void> };
let lock: Lock | null = null;
let usos = 0;

async function pedir() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
    lock = (await wl?.request("screen")) ?? null;
  } catch {
    lock = null;
  }
}

function alVolver() {
  if (document.visibilityState === "visible" && usos > 0 && !lock) pedir();
}

export function mantenerDespierto() {
  usos++;
  if (usos === 1) {
    pedir();
    document.addEventListener("visibilitychange", alVolver);
  }
  let soltado = false;
  return () => {
    if (soltado) return;
    soltado = true;
    usos--;
    if (usos === 0) {
      document.removeEventListener("visibilitychange", alVolver);
      lock?.release().catch(() => {});
      lock = null;
    }
  };
}
