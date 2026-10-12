import { z } from "zod";

export const TIPOS_HOOK = ["polémica", "pregunta", "historia", "dato", "curiosidad"] as const;
export type TipoHook = (typeof TIPOS_HOOK)[number];

export const PLATAFORMAS = ["tiktok", "reels", "shorts"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export const TONOS_IDS = ["cercano", "divertido", "directo", "experto", "inspirador"] as const;

/* ---------- Request bodies (validated on the server) ---------- */

const estiloInput = z
  .object({
    tono: z.enum(TONOS_IDS).default("cercano"),
    ejemplos: z.array(z.string().trim().max(200)).max(5).default([]),
  })
  .default({ tono: "cercano", ejemplos: [] });

const comun = {
  idea: z.string().trim().min(3, "Escribe tu idea con un poco más de detalle.").max(500),
  nicho: z.string().trim().max(40).optional(),
  plataforma: z.enum(PLATAFORMAS),
  estilo: estiloInput,
};

export const HooksRequest = z.object({ tipo: z.literal("hooks"), ...comun });

export const GuionRequest = z.object({
  tipo: z.literal("guion"),
  ...comun,
  hook: z.string().trim().min(3).max(300),
  hookTipo: z.enum(TIPOS_HOOK),
});

export const GenerarRequest = z.discriminatedUnion("tipo", [HooksRequest, GuionRequest]);
export type GenerarRequest = z.infer<typeof GenerarRequest>;

/* ---------- Model outputs (structured outputs) ---------- */

export const HooksOutput = z.object({
  hooks: z.array(
    z.object({
      texto: z.string().describe("El hook, máximo 15 palabras, listo para decirse a cámara"),
      tipo: z.enum(TIPOS_HOOK),
    }),
  ),
});
export type HooksOutput = z.infer<typeof HooksOutput>;

export const GuionOutput = z.object({
  guion: z.object({
    hook: z.string().describe("0–3 s: el hook tal cual o pulido"),
    desarrollo: z.string().describe("Cuerpo del video, frases cortas para decir a cámara"),
    cierre: z.string().describe("Cierre con llamada a la acción suave"),
    duracionSegundos: z.number().describe("Duración estimada leyendo en voz alta, entre 30 y 60"),
  }),
  captions: z.array(
    z.object({
      texto: z.string().describe("Caption para la publicación, 1–3 frases"),
      hashtags: z.array(z.string()).describe("3 a 6 hashtags, cada uno empieza con #"),
    }),
  ),
});
export type GuionOutput = z.infer<typeof GuionOutput>;

/* ---------- API responses ---------- */

export type Uso = { usados: number; limite: number; restantes: number };

export type HooksResponse = { hooks: HooksOutput["hooks"]; uso: Uso };
export type GuionResponse = GuionOutput & { uso: Uso };
export type ErrorResponse = { error: string; codigo?: "limite" | "validacion" | "ia" | "config"; uso?: Uso };
