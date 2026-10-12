"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const PREFIX = "hookly:";
const EVENTO = "hookly:storage";

/* localStorage can throw (private mode, blocked site data, quota). Never crash. */

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Values that couldn't be saved still live for this session. */
const memoria = new Map<string, string>();

export function writeJSON<T>(key: string, value: T): boolean {
  const raw = JSON.stringify(value);
  let ok = true;
  try {
    window.localStorage.setItem(PREFIX + key, raw);
    memoria.delete(key);
  } catch {
    ok = false;
    memoria.set(key, raw);
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: key }));
  return ok;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) cb();
  };
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", onStorage);
  };
}

const noop = () => () => {};

/** False during SSR and hydration, true afterwards. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * State persisted in localStorage. Renders `initial` on the server and during
 * hydration (no mismatch), then the saved value.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [fallback] = useState(initial);
  const raw = useSyncExternalStore(subscribe, () => leerActual(key), () => null);
  const loaded = useHydrated();

  const value = useMemo<T>(() => parse(raw, fallback), [raw, fallback]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      // Storage is written synchronously, so it always holds the latest value.
      const prev = parse<T>(leerActual(key), fallback);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeJSON(key, resolved);
    },
    [key, fallback],
  );

  return [value, update, loaded] as const;
}

function leerActual(key: string) {
  return memoria.get(key) ?? readRaw(key);
}

function parse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
