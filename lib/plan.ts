"use client";

import { usePersistentState } from "@/lib/storage";

/** Free plan limits. Keep in sync with the server limit in lib/rate-limit.ts. */
export const LIMITE_GRATIS_DIA = 3;

export const PLANES = {
  gratis: {
    nombre: "Gratis",
    precio: "$0",
    periodo: "",
    puntos: [
      `${LIMITE_GRATIS_DIA} generaciones de hooks al día`,
      "Guion y 5 captions por hook",
      "Subtítulos animados en tu navegador",
      "Exportación 720p con marca de agua",
      "Tu estilo guardado en este dispositivo",
    ],
  },
  pro: {
    nombre: "Pro",
    // Placeholder price: edit here when payments are connected.
    precio: "$99 MXN",
    periodo: "al mes",
    puntos: [
      "Generaciones de hooks sin límite diario (uso justo)",
      "Exportación sin marca de agua",
      "Exportación en 1080p",
      "Todo lo del plan Gratis",
    ],
  },
} as const;

/**
 * Payments are not connected yet. The Pro flag can only be simulated while
 * developing (or when NEXT_PUBLIC_PRO_DEMO=1) so a real visitor never gets it
 * by editing localStorage in production builds.
 */
export const PRO_DEMO_PERMITIDO =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_PRO_DEMO === "1";

export function usePlan() {
  const [proGuardado, setProGuardado, loaded] = usePersistentState<boolean>("pro", false);
  const isPro = PRO_DEMO_PERMITIDO && proGuardado === true;
  return { isPro, setProDemo: setProGuardado, loaded };
}
