import { fuente, type Estilo } from "@/lib/estilo";
import type { EstiloSubId } from "./types";

/**
 * One description per caption style, used by both the live preview (CSS) and
 * the exported video (ASS), so what you see is what you export. Sizes are
 * ratios of the video width.
 */
export type EstiloSub = {
  id: EstiloSubId;
  nombre: string;
  fuenteCss: string;
  fuenteAss: string;
  peso: number;
  tamano: number;
  mayusculas: boolean;
  texto: string;
  resaltado: string;
  /** Opacity of words that are not being spoken (1 = same as the active one). */
  inactivo: number;
  contorno: { color: string; grosor: number } | null;
  sombra: boolean;
  caja: { color: string; opacidad: number; padding: number } | null;
  /** Scale of the active word ("pop"). */
  pop: number;
};

const BRICOLAGE = fuente("bricolage");
const DMSANS = fuente("dmsans");

export const ESTILOS_FIJOS: Record<Exclude<EstiloSubId, "mio">, EstiloSub> = {
  bold: {
    id: "bold",
    nombre: "BOLD",
    fuenteCss: BRICOLAGE.css,
    fuenteAss: BRICOLAGE.ass,
    peso: BRICOLAGE.weight,
    tamano: 0.082,
    mayusculas: true,
    texto: "#FFFFFF",
    resaltado: "#C6F432",
    inactivo: 1,
    contorno: { color: "#000000", grosor: 0.0075 },
    sombra: false,
    caja: null,
    pop: 1.12,
  },
  clean: {
    id: "clean",
    nombre: "Clean",
    fuenteCss: DMSANS.css,
    fuenteAss: DMSANS.ass,
    peso: DMSANS.weight,
    tamano: 0.064,
    mayusculas: false,
    texto: "#FFFFFF",
    resaltado: "#FFFFFF",
    inactivo: 0.5,
    contorno: null,
    sombra: true,
    caja: null,
    pop: 1,
  },
  caja: {
    id: "caja",
    nombre: "Caja",
    fuenteCss: DMSANS.css,
    fuenteAss: DMSANS.ass,
    peso: DMSANS.weight,
    tamano: 0.066,
    mayusculas: false,
    texto: "#FFFFFF",
    resaltado: "#C6F432",
    inactivo: 1,
    contorno: null,
    sombra: false,
    caja: { color: "#0E0E10", opacidad: 1, padding: 0.016 },
    pop: 1,
  },
};

export function estiloMio(e: Estilo): EstiloSub {
  const f = fuente(e.fuente);
  return {
    id: "mio",
    nombre: "Mío",
    fuenteCss: f.css,
    fuenteAss: f.ass,
    peso: f.weight,
    tamano: f.id === "anton" ? 0.09 : f.id === "dmsans" ? 0.072 : 0.08,
    mayusculas: e.mayusculas,
    texto: e.colorTexto,
    resaltado: e.colorResaltado,
    inactivo: 1,
    contorno: { color: e.colorContorno, grosor: 0.0075 },
    sombra: false,
    caja: null,
    pop: 1.1,
  };
}

export function resolverEstilo(id: EstiloSubId, mio: Estilo): EstiloSub {
  return id === "mio" ? estiloMio(mio) : ESTILOS_FIJOS[id];
}

export const ORDEN_ESTILOS: EstiloSubId[] = ["bold", "clean", "caja", "mio"];

/** Vertical position of the caption baseline, as a ratio of height from the bottom. */
export const POSICION_Y = 0.24;
