export type Palabra = {
  text: string;
  start: number; // seconds
  end: number; // seconds
};

export type Grupo = {
  /** Index of the first word in the full word list. */
  desde: number;
  palabras: Palabra[];
  start: number;
  /** When the line leaves the screen (may extend a little past the last word). */
  end: number;
};

export type EstiloSubId = "bold" | "clean" | "caja" | "mio";
