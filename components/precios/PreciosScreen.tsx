"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { CASCADE_STEP, spring } from "@/lib/motion";
import { PLANES, PRO_DEMO_PERMITIDO, usePlan } from "@/lib/plan";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconCheck, IconChevronLeft } from "@/components/ui/icons";
import { Switch } from "@/components/ui/Switch";

export function PreciosScreen() {
  const router = useRouter();
  const { isPro, setProDemo } = usePlan();

  const planes = [
    { id: "gratis" as const, ...PLANES.gratis, destacado: false },
    { id: "pro" as const, ...PLANES.pro, destacado: true },
  ];

  return (
    <>
      <header className="pb-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/hooks"))}
          className="-ml-3 mb-4 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-muted hover:text-ink"
        >
          <IconChevronLeft size={18} />
          Volver
        </button>
        <h1 className="t-display">Planes</h1>
        <p className="mt-2 max-w-[34ch] text-[0.9375rem] text-muted">
          Empieza gratis. Pasa a Pro cuando Hookly ya sea parte de tu rutina.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {planes.map((p, i) => {
          const actual = (p.id === "pro") === isPro;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * CASCADE_STEP * 2 }}
            >
              <Card className={p.destacado ? "border-accent/60" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="t-title">{p.nombre}</h2>
                    <p className="mt-2">
                      <span className="font-display text-[2rem] font-bold tracking-[-0.02em]">{p.precio}</span>
                      {p.periodo && <span className="ml-1.5 text-sm text-muted">{p.periodo}</span>}
                    </p>
                  </div>
                  {actual && (
                    <span className="rounded-full bg-card-2 px-3 py-1 text-xs font-semibold text-muted">
                      Tu plan
                    </span>
                  )}
                </div>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {p.puntos.map((pt) => (
                    <li key={pt} className="flex gap-2.5 text-[0.9375rem]">
                      <IconCheck size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-accent" />
                      {pt}
                    </li>
                  ))}
                </ul>
                {p.id === "pro" && (
                  <>
                    <Button block disabled className="mt-5">
                      Muy pronto
                    </Button>
                    <p className="t-caption mt-2 text-center">
                      Los pagos todavía no están disponibles. Te avisaremos cuando abran.
                    </p>
                  </>
                )}
              </Card>
            </motion.div>
          );
        })}

        {PRO_DEMO_PERMITIDO && (
          <Card className="border-dashed">
            <Switch
              checked={isPro}
              onChange={setProDemo}
              label="Simular plan Pro"
              description="Solo en desarrollo o demos: quita la marca de agua y habilita 1080p en este navegador."
            />
          </Card>
        )}

        <p className="t-caption px-2 text-center">
          Hookly no promete vistas ni seguidores: te ayuda a crear más rápido y con tu estilo.
        </p>
      </div>
    </>
  );
}
