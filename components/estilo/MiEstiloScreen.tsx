"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  ESTILO_DEFAULT,
  FUENTES,
  MAX_EJEMPLO_CHARS,
  MAX_EJEMPLOS,
  TONOS,
  useEstilo,
  type Estilo,
} from "@/lib/estilo";
import { snappy, spring } from "@/lib/motion";
import { PageHeader } from "@/components/nav/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconCheck, IconPlus, IconTrash } from "@/components/ui/icons";
import { Switch } from "@/components/ui/Switch";
import { ColorField } from "./ColorField";
import { EstiloPreview } from "./EstiloPreview";

const PRESETS_TEXTO = ["#FFFFFF", "#F4F4F5", "#FFE14D", "#0E0E10"];
const PRESETS_RESALTADO = ["#C6F432", "#FFE14D", "#FF5CA8", "#4DD8FF", "#FF7A45"];
const PRESETS_CONTORNO = ["#0E0E10", "#000000", "#FFFFFF", "#3A2BFF"];

function Seccion({ titulo, children, nota }: { titulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="t-title">{titulo}</h2>
        {nota && <p className="mt-1 text-sm text-muted">{nota}</p>}
      </div>
      {children}
    </Card>
  );
}

export function MiEstiloScreen() {
  const [estilo, setEstilo, loaded] = useEstilo();
  const [guardado, setGuardado] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const cambiar = (parcial: Partial<Estilo>) => {
    setEstilo((prev) => ({ ...ESTILO_DEFAULT, ...prev, ...parcial }));
    setGuardado(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setGuardado(false), 1400);
  };

  const ejemplos = estilo.ejemplos;
  const setEjemplo = (i: number, v: string) =>
    cambiar({ ejemplos: ejemplos.map((e, j) => (j === i ? v.slice(0, MAX_EJEMPLO_CHARS) : e)) });

  return (
    <>
      <PageHeader
        title="Mi estilo"
        subtitle="Tus colores, fuente y voz. Todo lo que generes lo usa."
        aside={
          <AnimatePresence>
            {guardado && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={snappy}
                className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent/15 px-3 text-xs font-semibold text-accent"
                role="status"
              >
                <IconCheck size={14} strokeWidth={2.6} />
                Guardado
              </motion.span>
            )}
          </AnimatePresence>
        }
      />

      <div className={"flex flex-col gap-4 transition-opacity duration-200 " + (loaded ? "" : "opacity-0")}>
        <div className="mx-auto w-full max-w-[15rem]">
          <EstiloPreview estilo={estilo} />
          <p className="t-caption mt-2 text-center">Estilo &ldquo;Mío&rdquo; en Subtítulos</p>
        </div>

        <Seccion titulo="Colores de subtítulos">
          <ColorField
            label="Texto"
            value={estilo.colorTexto}
            onChange={(v) => cambiar({ colorTexto: v })}
            presets={PRESETS_TEXTO}
          />
          <ColorField
            label="Palabra activa"
            value={estilo.colorResaltado}
            onChange={(v) => cambiar({ colorResaltado: v })}
            presets={PRESETS_RESALTADO}
          />
          <ColorField
            label="Contorno"
            value={estilo.colorContorno}
            onChange={(v) => cambiar({ colorContorno: v })}
            presets={PRESETS_CONTORNO}
          />
        </Seccion>

        <Seccion titulo="Fuente">
          <div role="radiogroup" aria-label="Fuente" className="grid grid-cols-3 gap-2">
            {FUENTES.map((f) => {
              const on = estilo.fuente === f.id;
              return (
                <motion.button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  whileTap={{ scale: 0.96 }}
                  transition={snappy}
                  onClick={() => cambiar({ fuente: f.id })}
                  className={
                    "relative flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border transition-colors " +
                    (on ? "border-accent bg-accent/10" : "border-line bg-card-2")
                  }
                >
                  <span style={{ fontFamily: f.css, fontWeight: f.weight }} className="text-2xl leading-none">
                    Aa
                  </span>
                  <span className={"text-xs font-semibold " + (on ? "text-ink" : "text-muted")}>{f.label}</span>
                  {on && (
                    <motion.span
                      layoutId="fuente-sel"
                      transition={spring}
                      className="absolute inset-0 rounded-2xl ring-2 ring-accent"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
          <Switch
            checked={estilo.mayusculas}
            onChange={(v) => cambiar({ mayusculas: v })}
            label="Todo en mayúsculas"
          />
        </Seccion>

        <Seccion titulo="Tono de voz" nota="Los hooks y guiones se escriben con este tono.">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tono de voz">
            {TONOS.map((t) => (
              <Chip key={t.id} selected={estilo.tono === t.id} onClick={() => cambiar({ tono: t.id })}>
                {t.label}
              </Chip>
            ))}
          </div>
          <p className="text-sm text-muted">{TONOS.find((t) => t.id === estilo.tono)?.desc}</p>
        </Seccion>

        <Seccion
          titulo="Mis mejores hooks"
          nota={`Hasta ${MAX_EJEMPLOS} ejemplos que te hayan funcionado. La IA imita tu voz, sin copiarlos.`}
        >
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {ejemplos.map((e, i) => (
                <motion.li
                  key={i}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={spring}
                  className="flex items-start gap-2"
                >
                  <textarea
                    value={e}
                    onChange={(ev) => setEjemplo(i, ev.target.value)}
                    rows={2}
                    maxLength={MAX_EJEMPLO_CHARS}
                    placeholder="Ej. Nadie te dice esto antes de rentar tu primer depa"
                    aria-label={`Ejemplo ${i + 1}`}
                    className="field min-h-11 flex-1 resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => cambiar({ ejemplos: ejemplos.filter((_, j) => j !== i) })}
                    aria-label={`Quitar ejemplo ${i + 1}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-faint hover:bg-card-2 hover:text-danger"
                  >
                    <IconTrash size={18} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {ejemplos.length < MAX_EJEMPLOS && (
            <Button variant="secondary" onClick={() => cambiar({ ejemplos: [...ejemplos, ""] })}>
              <IconPlus size={18} />
              Agregar ejemplo
            </Button>
          )}
        </Seccion>

        <div className="flex flex-col items-center gap-1 pt-2">
          <Button variant="ghost" onClick={() => cambiar({ ...ESTILO_DEFAULT })}>
            Restablecer valores
          </Button>
          <p className="t-caption text-center">Se guarda solo en este dispositivo.</p>
        </div>
      </div>
    </>
  );
}
