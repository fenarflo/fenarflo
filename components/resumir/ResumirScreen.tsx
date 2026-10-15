"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { formatoTiempo } from "@/lib/captions/group";
import { useCuenta } from "@/lib/cuenta";
import { useEstilo } from "@/lib/estilo";
import { spring } from "@/lib/motion";
import { minutosDe, MAX_VIDEO_MIN } from "@/lib/planes";
import { OBJETIVOS, resumen, useResumen } from "@/lib/resumen/sesion";
import type { Modo } from "@/lib/resumen/schema";
import { mb } from "@/lib/video/limits";
import { PageHeader } from "@/components/nav/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { IconBook, IconScissors, IconSummary, IconUpload } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Procesando } from "./Procesando";
import { Resultado } from "./Resultado";

const MODOS: { id: Modo; titulo: string; desc: string; Icon: typeof IconSummary }[] = [
  { id: "resumen", titulo: "Resumen narrado", desc: "Lo más importante de todo el video, explicado por un narrador.", Icon: IconSummary },
  { id: "clase", titulo: "Clase", desc: "Video de repaso, apuntes, conceptos y quiz para estudiar.", Icon: IconBook },
  { id: "shorts", titulo: "Shorts", desc: "Varios clips verticales con hook, texto y hashtags.", Icon: IconScissors },
];

export function etiquetaDuracion(s: number) {
  return s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s / 60} min`;
}

function SaldoChip() {
  const { cuenta } = useCuenta();
  if (!cuenta) return null;
  return (
    <Link
      href="/cuenta"
      className={
        "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold tabular-nums " +
        (cuenta.minutos < 5 ? "border-danger/40 text-danger" : "border-line text-muted")
      }
    >
      <span className="mr-1 text-ink">{cuenta.minutos}</span> min
    </Link>
  );
}

function SelectorModo() {
  const s = useResumen();
  return (
    <div role="radiogroup" aria-label="Qué quieres hacer" className="grid gap-2.5">
      {MODOS.map(({ id, titulo, desc, Icon }) => {
        const activo = s.prefs.modo === id;
        return (
          <motion.button
            key={id}
            type="button"
            role="radio"
            aria-checked={activo}
            whileTap={{ scale: 0.98 }}
            transition={spring}
            onClick={() => resumen.setPrefs({ modo: id })}
            className={
              "flex min-h-11 touch-manipulation items-center gap-3.5 rounded-[var(--radius-card)] border p-3.5 text-left transition-colors duration-150 " +
              (activo ? "border-accent bg-accent/10" : "border-line bg-card hover:border-faint")
            }
          >
            <span
              className={
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl " + (activo ? "bg-accent text-accent-ink" : "bg-card-2 text-accent")
              }
            >
              <Icon size={22} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{titulo}</span>
              <span className="block text-sm text-muted">{desc}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Subir({ cargando }: { cargando: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        const f = e.dataTransfer.files?.[0];
        if (f) resumen.elegir(f);
      }}
      className={
        "flex flex-col items-center rounded-[var(--radius-card)] border border-dashed px-6 py-9 text-center transition-colors duration-150 " +
        (arrastrando ? "border-accent bg-accent/5" : "border-line bg-card")
      }
    >
      <h2 className="t-title">Sube tu video</h2>
      <p className="mt-1.5 max-w-[32ch] text-sm text-muted">
        De 1 minuto a {MAX_VIDEO_MIN / 60} horas. Tu video se queda en tu teléfono: solo se envía el audio.
      </p>
      <input
        ref={input}
        type="file"
        accept="video/*,audio/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) resumen.elegir(f);
          e.target.value = "";
        }}
      />
      <Button className="mt-5 px-6" onClick={() => input.current?.click()} disabled={cargando}>
        {cargando ? <span className="spinner" aria-hidden="true" /> : <IconUpload size={19} />}
        {cargando ? "Revisando video…" : "Elegir video"}
      </Button>
      <p className="t-caption mt-4">Un video de 1 hora pesa mucho: si puedes, usa WiFi.</p>
    </div>
  );
}

function Opciones() {
  const s = useResumen();
  const { cuenta, servicios } = useCuenta();
  const [estilo] = useEstilo();
  const p = s.prefs;
  if (!s.info || !s.file) return null;

  const minutos = minutosDe(s.info.duracion);
  const alcanza = !cuenta || cuenta.minutos >= minutos;
  const maxResumen = cuenta?.maxResumen ?? 60;
  const sinVoz = servicios && !servicios.voz;
  const horizontal = s.info.ancho > s.info.alto;
  const cambiaForma = (p.formato === "vertical") === horizontal;
  const verbo = p.modo === "shorts" ? "Crear shorts" : p.modo === "clase" ? "Resumir clase" : "Crear resumen";

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex gap-4">
        <video
          src={s.url}
          muted
          playsInline
          preload="metadata"
          className={"w-24 shrink-0 rounded-xl bg-black object-cover " + (horizontal ? "aspect-video" : "aspect-[9/16]")}
        />
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate font-semibold">{s.file.name}</p>
          <p className="t-caption mt-1">
            {formatoTiempo(s.info.duracion)} · {mb(s.file.size)} MB
          </p>
          <p className={"mt-1.5 text-sm " + (alcanza ? "text-muted" : "text-danger")}>
            Usa {minutos} min{cuenta ? ` · te quedan ${cuenta.minutos}` : ""}
          </p>
          <button type="button" onClick={resumen.reiniciar} className="min-h-11 text-sm font-semibold text-muted hover:text-ink">
            Cambiar video
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="t-label">{p.modo === "shorts" ? "Duración de cada short" : "Duración del resumen"}</span>
        <div className="flex flex-wrap gap-2">
          {OBJETIVOS[p.modo].map((o) => {
            const bloqueado = o > maxResumen;
            return (
              <Chip key={o} selected={p.objetivo === o} onClick={() => (bloqueado ? null : resumen.setPrefs({ objetivo: o }))}>
                {etiquetaDuracion(o)}
                {bloqueado ? " · Pro" : ""}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="t-label">Narrador</span>
        <Segmented
          label="Narrador"
          value={p.narrador}
          onChange={(narrador) => resumen.setPrefs({ narrador })}
          options={[
            { id: "voz", label: "Con voz" },
            { id: "texto", label: "En texto" },
            { id: "no", label: "Sin narrador" },
          ]}
        />
        <p className="t-caption">
          {p.narrador === "voz"
            ? "Una voz natural explica cada punto durante todo el video. El audio original baja mientras habla."
            : p.narrador === "texto"
              ? "La explicación aparece como texto en pantalla y se escucha el audio original."
              : "Solo los mejores fragmentos con su audio original y subtítulos."}
          {p.narrador === "voz" && sinVoz ? " La voz no está configurada en este servidor: se usará texto." : ""}
        </p>
      </div>

      {p.narrador === "voz" && (
        <div className="flex flex-col gap-2.5">
          <span className="t-label">Voz</span>
          <Segmented
            label="Voz"
            value={p.voz}
            onChange={(voz) => resumen.setPrefs({ voz })}
            options={[
              { id: "marin", label: "Femenina" },
              { id: "cedar", label: "Masculina" },
            ]}
          />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <span className="t-label">Formato</span>
        <Segmented
          label="Formato"
          value={p.formato}
          onChange={(formato) => resumen.setPrefs({ formato })}
          options={[
            { id: "vertical", label: "Vertical 9:16" },
            { id: "horizontal", label: "Horizontal 16:9" },
          ]}
        />
        {cambiaForma && (
          <Segmented
            label="Encuadre"
            value={p.encuadre}
            onChange={(encuadre) => resumen.setPrefs({ encuadre })}
            options={[
              { id: "llenar", label: "Llenar pantalla" },
              { id: "completo", label: "Video completo" },
            ]}
          />
        )}
      </div>

      <label className="flex flex-col gap-2">
        <span className="t-label">¿De qué trata? (opcional)</span>
        <input
          className="field"
          value={s.tema}
          maxLength={200}
          onChange={(e) => resumen.setTema(e.target.value)}
          placeholder={p.modo === "clase" ? "Ej. Cálculo diferencial: derivadas" : "Ej. Entrevista sobre finanzas personales"}
        />
      </label>

      {alcanza ? (
        <Button block className="min-h-13 text-base" onClick={() => resumen.crear(estilo.tono, maxResumen)}>
          {verbo}
        </Button>
      ) : (
        <Link
          href="/cuenta"
          className="inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-accent px-4 text-base font-semibold text-accent-ink"
        >
          Conseguir más minutos
        </Link>
      )}
      <p className="t-caption -mt-2 text-center">
        Mantén esta pantalla abierta mientras trabajamos. Un video de 1 hora tarda unos minutos.
      </p>
    </Card>
  );
}

export function ResumirScreen() {
  const s = useResumen();
  return (
    <>
      <PageHeader title="Resumir" subtitle="Sube un video largo y quédate con lo importante, narrado y listo para publicar o estudiar." aside={<SaldoChip />} />

      <AnimatePresence>
        {s.error && (
          <div>
            <ErrorCard mensaje={s.error} onClose={resumen.limpiarError} />
            {s.errorCodigo === "saldo" && (
              <Link href="/cuenta" className="-mt-2 mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent">
                Ver planes y paquetes
              </Link>
            )}
          </div>
        )}
      </AnimatePresence>

      {(s.fase === "vacio" || s.fase === "validando" || s.fase === "listo") && (
        <div className="flex flex-col gap-5">
          <SelectorModo />
          {s.fase === "listo" ? <Opciones /> : <Subir cargando={s.fase === "validando"} />}
        </div>
      )}

      {s.fase === "procesando" && <Procesando />}
      {s.fase === "resultado" && s.resultado && <Resultado />}
    </>
  );
}
