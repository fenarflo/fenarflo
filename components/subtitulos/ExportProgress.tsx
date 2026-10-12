"use client";

import { useEffect, useRef, useState } from "react";
import { sesion } from "@/lib/video/sesion";
import type { FaseExport } from "@/lib/video/export";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

function restante(seg: number) {
  if (seg < 60) return "menos de un minuto";
  const m = Math.round(seg / 60);
  return m === 1 ? "1 minuto" : `${m} minutos`;
}

export function ExportProgress({ avance }: { avance?: FaseExport }) {
  const inicio = useRef<number | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const progreso = avance?.progreso ?? 0;
  const codificando = avance?.fase === "codificando";

  useEffect(() => {
    if (!codificando) return;
    const ahora = performance.now();
    if (inicio.current == null) {
      inicio.current = ahora;
      return;
    }
    if (progreso > 0.04) {
      const transcurrido = (ahora - inicio.current) / 1000;
      const total = transcurrido / progreso;
      setEta(restante(Math.max(0, total - transcurrido)));
    }
  }, [progreso, codificando]);

  return (
    <Card className="flex flex-col gap-4" aria-live="polite">
      {codificando ? (
        <ProgressBar
          value={progreso}
          label="Exportando video"
          detail={eta ? `Faltan aprox. ${eta}. No cierres esta pestaña.` : "Calculando tiempo… No cierres esta pestaña."}
        />
      ) : (
        <ProgressBar
          value={progreso}
          label="Preparando el editor de video"
          detail="Solo la primera vez se descargan unos 30 MB."
        />
      )}
      <Button variant="secondary" onClick={sesion.cancelarExportacion}>
        Cancelar
      </Button>
    </Card>
  );
}
