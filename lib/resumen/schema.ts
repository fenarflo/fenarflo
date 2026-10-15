import { z } from "zod";
import { TONOS_IDS } from "@/lib/ai/schema";

/* Shapes shared by the summary API routes and the browser. Times are seconds in the source video. */

export const MODOS = ["resumen", "clase", "shorts"] as const;
export type Modo = (typeof MODOS)[number];

export const NARRADOR = ["voz", "texto", "no"] as const;
export type Narrador = (typeof NARRADOR)[number];

export const VOCES = ["marin", "cedar"] as const;
export type Voz = (typeof VOCES)[number];

/* ---------- Requests ---------- */

export const TrabajoRequest = z.object({
  duracion: z.number().positive().max(4 * 3600),
  modo: z.enum(MODOS),
});

export const Linea = z.object({ t: z.number().min(0), texto: z.string().max(600) });
export type Linea = z.infer<typeof Linea>;

export const PuntosRequest = z.object({
  token: z.string(),
  modo: z.enum(MODOS),
  inicio: z.number().min(0),
  fin: z.number().min(0),
  lineas: z.array(Linea).min(1).max(500),
});

export const MomentoInput = z.object({
  inicio: z.number().min(0),
  fin: z.number().min(0),
  idea: z.string().max(300),
  importancia: z.number(),
  autonomo: z.boolean(),
  cita: z.string().max(400).default(""),
});

export const ArmarRequest = z.object({
  token: z.string(),
  modo: z.enum(MODOS),
  objetivo: z.number().min(10).max(600),
  narrador: z.enum(NARRADOR),
  duracionVideo: z.number().positive(),
  tema: z.string().trim().max(200).default(""),
  tono: z.enum(TONOS_IDS).default("cercano"),
  resumenes: z.array(z.string().max(1200)).max(80),
  momentos: z.array(MomentoInput).min(1).max(240),
  variante: z.number().int().min(0).max(5).default(0),
});

export const VozRequest = z.object({
  token: z.string(),
  texto: z.string().trim().min(1).max(1200),
  voz: z.enum(VOCES),
  modo: z.enum(MODOS),
});

/* ---------- Model outputs (structured) ---------- */

export const PuntosOutput = z.object({
  resumen: z.string().describe("2 a 3 frases: de qué trata este tramo"),
  momentos: z.array(
    z.object({
      inicio: z.number().describe("segundo exacto donde empieza la frase, tomado de las marcas [s]"),
      fin: z.number().describe("segundo donde termina la idea, al final de una frase"),
      idea: z.string().describe("la idea en una frase corta, en tus palabras"),
      importancia: z.number().describe("1 a 5; 5 = imprescindible para entender el video"),
      autonomo: z.boolean().describe("true si el fragmento se entiende sin haber visto lo anterior"),
      cita: z.string().describe("la frase clave tal como se dijo, máximo 25 palabras"),
    }),
  ),
});
export type PuntosOutput = z.infer<typeof PuntosOutput>;
export type Momento = PuntosOutput["momentos"][number];

const Segmento = z.object({
  inicio: z.number(),
  fin: z.number(),
  narracion: z.string().describe("lo que dice el narrador sobre este fragmento; vacío si no hay narrador"),
});
export type Segmento = z.infer<typeof Segmento>;

const Marca = z.object({ inicio: z.number(), titulo: z.string() });

export const ResumenOutput = z.object({
  titulo: z.string().describe("título corto para la portada, máximo 7 palabras"),
  segmentos: z.array(Segmento),
  capitulos: z.array(Marca).describe("capítulos del video original para la descripción de YouTube"),
  textoPublicacion: z.string(),
  hashtags: z.array(z.string()),
  comentarioFijado: z.string().describe("comentario para fijar que invite a conversar, sin pedir likes"),
});

/* Classes are written by two parallel calls (video plan, study material) to keep each one fast. */
export const ClaseVideoOutput = z.object({
  titulo: z.string().describe("tema de la clase, máximo 7 palabras"),
  segmentos: z.array(Segmento),
  momentosClave: z.array(Marca),
});

export const ClaseEstudioOutput = z.object({
  apuntes: z.array(z.object({ titulo: z.string(), puntos: z.array(z.string()) })),
  conceptos: z.array(z.object({ termino: z.string(), definicion: z.string() })),
  quiz: z.array(
    z.object({
      pregunta: z.string(),
      opciones: z.array(z.string()).describe("exactamente 4 opciones"),
      correcta: z.number().describe("índice 0-3 de la opción correcta"),
      explicacion: z.string(),
    }),
  ),
});

export const ShortsOutput = z.object({
  shorts: z.array(
    z.object({
      titulo: z.string().describe("hook en pantalla, máximo 7 palabras"),
      segmentos: z.array(Segmento),
      caption: z.string(),
      hashtags: z.array(z.string()),
      comentarioFijado: z.string(),
      autonomo: z.boolean().describe("true si se entiende sin ver el video completo"),
      porque: z.string().describe("por qué este fragmento funciona solo, en una frase"),
    }),
  ),
});

export type ResumenOutput = z.infer<typeof ResumenOutput>;
export type ClaseOutput = z.infer<typeof ClaseVideoOutput> & z.infer<typeof ClaseEstudioOutput>;
export type ShortsOutput = z.infer<typeof ShortsOutput>;

/* ---------- What the browser works with ---------- */

export type Corte = { inicio: number; fin: number; narracion: string };

export type Pieza = {
  titulo: string;
  cortes: Corte[];
  caption?: string;
  hashtags?: string[];
  comentarioFijado?: string;
  autonomo?: boolean;
  porque?: string;
};

export type PlanResumen =
  | ({ modo: "resumen"; pieza: Pieza } & Omit<ResumenOutput, "segmentos" | "titulo">)
  | ({ modo: "clase"; pieza: Pieza } & Omit<ClaseOutput, "segmentos" | "titulo">)
  | { modo: "shorts"; piezas: Pieza[] };

export type ErrorApi = { error: string; codigo: "validacion" | "config" | "saldo" | "ia" | "token" | "limite" };
