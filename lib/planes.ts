/*
 * What Hookly sells. Shared by the pricing screen and the server (Stripe
 * Checkout builds its prices from here, so there is nothing to create by hand
 * in the Stripe dashboard). Amounts are in MXN cents.
 *
 * Minutes are minutes of *source* video: summarizing a 40-minute class costs
 * 40 minutes, whatever the length of the summary.
 */

export type PlanId = "gratis" | "estudiante" | "pro";
export type PaqueteId = "paquete120" | "paquete600";
export type ProductoId = Exclude<PlanId, "gratis"> | PaqueteId;

export type Plan = {
  id: PlanId;
  nombre: string;
  precioCentavos: number;
  minutosMes: number;
  marcaDeAgua: boolean;
  /** Longest summary the plan can export, in seconds. */
  maxResumen: number;
  /** Hooks generations per day (the Hooks tab). */
  hooksDia: number;
  puntos: string[];
};

export const PLANES: Record<PlanId, Plan> = {
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    precioCentavos: 0,
    minutosMes: 15,
    marcaDeAgua: true,
    maxResumen: 60,
    hooksDia: 3,
    puntos: [
      "15 minutos de video al mes",
      "Resúmenes de hasta 60 segundos",
      "Narrador con voz natural",
      "3 generaciones de hooks al día",
      "Con marca de agua",
    ],
  },
  estudiante: {
    id: "estudiante",
    nombre: "Estudiante",
    precioCentavos: 6900,
    minutosMes: 300,
    marcaDeAgua: false,
    maxResumen: 300,
    hooksDia: 10,
    puntos: [
      "5 horas de clases al mes",
      "Video resumen narrado de cada clase",
      "Apuntes, conceptos clave y quiz para repasar",
      "Momentos clave con minuto exacto",
      "Sin marca de agua",
    ],
  },
  pro: {
    id: "pro",
    nombre: "Creador Pro",
    precioCentavos: 14900,
    minutosMes: 600,
    marcaDeAgua: false,
    maxResumen: 300,
    hooksDia: 50,
    puntos: [
      "10 horas de video al mes",
      "Varios shorts de un solo video largo",
      "Capítulos para YouTube, texto y comentario fijado",
      "Hooks casi sin límite (50 al día)",
      "Sin marca de agua, en 1080p",
    ],
  },
};

export type Paquete = { id: PaqueteId; nombre: string; precioCentavos: number; minutos: number; detalle: string };

export const PAQUETES: Record<PaqueteId, Paquete> = {
  paquete120: {
    id: "paquete120",
    nombre: "2 horas extra",
    precioCentavos: 4900,
    minutos: 120,
    detalle: "Pago único. No caduca. Puedes pagar en OXXO.",
  },
  paquete600: {
    id: "paquete600",
    nombre: "10 horas extra",
    precioCentavos: 17900,
    minutos: 600,
    detalle: "Pago único. No caduca. Ideal para fin de semestre.",
  },
};

/** Minutes both people get when someone they invited makes their first payment. */
export const REFERIDO_MINUTOS = { invita: 60, invitado: 30 };

/** Free minutes per IP and month: stops cookie-clearing loops, generous for shared mobile IPs. */
export const GRATIS_POR_IP_MES = 60;

/** Longest video we accept, in minutes. */
export const MAX_VIDEO_MIN = 180;

export function esPlan(id: string): id is Exclude<PlanId, "gratis"> {
  return id === "estudiante" || id === "pro";
}
export function esPaquete(id: string): id is PaqueteId {
  return id in PAQUETES;
}

export function precioMXN(centavos: number) {
  return centavos === 0 ? "$0" : `$${(centavos / 100).toFixed(0)} MXN`;
}

/** Billed minutes for a video of `segundos` seconds (rounded up, at least 1). */
export function minutosDe(segundos: number) {
  return Math.max(1, Math.ceil(segundos / 60 - 0.05));
}
