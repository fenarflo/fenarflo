"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Palabra } from "@/lib/captions/types";
import { snappy } from "@/lib/motion";
import type { PiezaLista } from "@/lib/resumen/pipeline";
import { conectarAudio, construirLinea, Motor, nuevoAudio, type Audio, type OpcionesRender } from "@/lib/resumen/render";
import { IconPause, IconPlay } from "@/components/ui/icons";

function mmss(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Preview of the summary, drawn by the same engine that exports it. */
export function Reproductor({
  url,
  pieza,
  palabras,
  opciones,
}: {
  url: string;
  pieza: PiezaLista;
  palabras: Palabra[];
  opciones: OpcionesRender;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const audio = useRef<Audio | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const [tocando, setTocando] = useState(false);
  const [tl, setTl] = useState(0);
  const linea = useMemo(() => construirLinea(pieza, palabras, opciones.narrador), [pieza, palabras, opciones.narrador]);

  // A new engine whenever what we draw changes; keeps the current position.
  useEffect(() => {
    const v = video.current;
    const c = canvas.current;
    if (!v || !c) return;
    ctl.current?.abort();
    const m = new Motor(v, c, linea, opciones, audio.current);
    motor.current = m;
    let vivo = true;
    const mostrar = () =>
      m.listo().then(() => {
        if (vivo) m.mostrar(Math.min(m.ultimoTl, linea.total - 0.1));
      });
    if (v.readyState >= 1) mostrar();
    else v.addEventListener("loadedmetadata", mostrar, { once: true });
    return () => {
      vivo = false;
      v.removeEventListener("loadedmetadata", mostrar);
    };
  }, [linea, opciones]);

  useEffect(() => () => {
    ctl.current?.abort();
    audio.current?.ac.close().catch(() => {});
  }, []);

  const reproducir = (desde: number) => {
    const v = video.current;
    const c = canvas.current;
    if (!v || !c) return;
    // iOS: the audio graph and the first play() must happen inside the tap.
    if (!audio.current) {
      const ac = nuevoAudio();
      if (ac) audio.current = conectarAudio(v, ac);
      motor.current = new Motor(v, c, linea, opciones, audio.current);
    }
    audio.current?.ac.resume().catch(() => {});
    v.play()
      .then(() => v.pause())
      .catch(() => {});
    const m = motor.current!;
    const ac = new AbortController();
    ctl.current?.abort();
    ctl.current = ac;
    setTocando(true);
    m.listo()
      .then(() => m.reproducir({ desde: desde >= linea.total - 0.2 ? 0 : desde, signal: ac.signal, onTiempo: setTl }))
      .catch(() => {})
      .finally(() => {
        if (ctl.current !== ac) return;
        setTocando(false);
        if (!ac.signal.aborted) {
          setTl(0);
          m.mostrar(0);
        }
      });
  };

  const pausar = () => {
    const m = motor.current;
    ctl.current?.abort();
    ctl.current = null;
    setTocando(false);
    if (m) setTl(m.ultimoTl);
  };

  const buscar = (t: number) => {
    const eraTocando = tocando;
    pausar();
    setTl(t);
    motor.current?.mostrar(t).then(() => eraTocando && reproducir(t));
  };

  const vertical = opciones.formato === "vertical";
  return (
    <div className="flex flex-col items-center gap-3">
      <video ref={video} src={url} playsInline preload="auto" className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0" aria-hidden="true" />
      <div className={"relative overflow-hidden rounded-2xl bg-black " + (vertical ? "aspect-[9/16] w-full max-w-[20rem]" : "aspect-video w-full")}>
        <canvas ref={canvas} className="h-full w-full" onClick={() => (tocando ? pausar() : reproducir(tl))} />
        {!tocando && (
          <motion.button
            type="button"
            aria-label="Reproducir"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={snappy}
            onClick={() => reproducir(tl)}
            className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
          >
            <IconPlay size={28} />
          </motion.button>
        )}
      </div>
      <div className="flex w-full max-w-[20rem] items-center gap-3">
        <button
          type="button"
          aria-label={tocando ? "Pausar" : "Reproducir"}
          onClick={() => (tocando ? pausar() : reproducir(tl))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card-2 text-ink"
        >
          {tocando ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        <input
          type="range"
          aria-label="Posición"
          min={0}
          max={Math.max(0.1, linea.total)}
          step={0.1}
          value={Math.min(tl, linea.total)}
          onChange={(e) => buscar(Number(e.target.value))}
          className="h-11 flex-1 accent-[var(--color-accent)]"
        />
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted">
          {mmss(tl)} / {mmss(linea.total)}
        </span>
      </div>
    </div>
  );
}
