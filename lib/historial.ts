"use client";

import type { HooksOutput, Plataforma } from "@/lib/ai/schema";
import { usePersistentState } from "@/lib/storage";

export type EntradaHistorial = {
  id: string;
  fecha: number;
  idea: string;
  nicho?: string;
  plataforma: Plataforma;
  hooks: HooksOutput["hooks"];
};

const MAX = 20;

export function useHistorial() {
  const [items, setItems, loaded] = usePersistentState<EntradaHistorial[]>("historial", []);
  const agregar = (e: Omit<EntradaHistorial, "id" | "fecha">) =>
    setItems((prev) =>
      [{ ...e, id: crypto.randomUUID(), fecha: Date.now() }, ...(Array.isArray(prev) ? prev : [])].slice(0, MAX),
    );
  const borrar = () => setItems([]);
  return { items: Array.isArray(items) ? items : [], agregar, borrar, loaded };
}
