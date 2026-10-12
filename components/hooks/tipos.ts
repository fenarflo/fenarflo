import type { TipoHook } from "@/lib/ai/schema";

export const TIPO_ESTILO: Record<TipoHook, { label: string; color: string }> = {
  polémica: { label: "Polémica", color: "#FF8A66" },
  pregunta: { label: "Pregunta", color: "#7CC6FE" },
  historia: { label: "Historia", color: "#F5C26B" },
  dato: { label: "Dato", color: "#C6F432" },
  curiosidad: { label: "Curiosidad", color: "#C9A2FF" },
};

export const NICHOS = [
  "Finanzas",
  "Fitness",
  "Comida",
  "Belleza",
  "Tecnología",
  "Educación",
  "Humor",
  "Viajes",
  "Negocios",
  "Gaming",
  "Moda",
  "Crianza",
] as const;

export const PLATAFORMA_OPCIONES = [
  { id: "tiktok", label: "TikTok" },
  { id: "reels", label: "Reels" },
  { id: "shorts", label: "Shorts" },
] as const;
