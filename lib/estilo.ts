"use client";

import { usePersistentState } from "@/lib/storage";

export const TONOS = [
  { id: "cercano", label: "Cercano", desc: "Como platicando con un amigo" },
  { id: "divertido", label: "Divertido", desc: "Ligero, con humor" },
  { id: "directo", label: "Directo", desc: "Al grano, sin rodeos" },
  { id: "experto", label: "Experto", desc: "Con autoridad y claridad" },
  { id: "inspirador", label: "Inspirador", desc: "Motivador, sin exagerar" },
] as const;
export type Tono = (typeof TONOS)[number]["id"];

// `ass` must be the font file's family name (name ID 1): ffmpeg.wasm's libass matches nothing else.
export const FUENTES = [
  { id: "bricolage", label: "Bricolage", css: "var(--font-display)", ass: "Bricolage Grotesque ExtraBold", weight: 800 },
  { id: "dmsans", label: "DM Sans", css: "var(--font-sans)", ass: "DM Sans", weight: 700 },
  { id: "anton", label: "Anton", css: "var(--font-anton)", ass: "Anton", weight: 400 },
] as const;
export type FuenteId = (typeof FUENTES)[number]["id"];

export function fuente(id: FuenteId) {
  return FUENTES.find((f) => f.id === id) ?? FUENTES[0];
}

export type Estilo = {
  colorTexto: string;
  colorResaltado: string;
  colorContorno: string;
  fuente: FuenteId;
  mayusculas: boolean;
  tono: Tono;
  ejemplos: string[];
};

export const MAX_EJEMPLOS = 5;
export const MAX_EJEMPLO_CHARS = 200;

export const ESTILO_DEFAULT: Estilo = {
  colorTexto: "#FFFFFF",
  colorResaltado: "#C6F432",
  colorContorno: "#0E0E10",
  fuente: "bricolage",
  mayusculas: true,
  tono: "cercano",
  ejemplos: [],
};

export function useEstilo() {
  const [estilo, setEstilo, loaded] = usePersistentState<Estilo>("estilo", ESTILO_DEFAULT);
  // Merge with defaults so older saved shapes keep working.
  return [{ ...ESTILO_DEFAULT, ...estilo }, setEstilo, loaded] as const;
}

/** True when the person changed anything from the defaults. */
export function estiloPersonalizado(e: Estilo) {
  return JSON.stringify({ ...e }) !== JSON.stringify(ESTILO_DEFAULT);
}
