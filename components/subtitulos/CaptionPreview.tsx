"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { EstiloSub } from "@/lib/captions/estilos";
import { formatoTiempo, grupoEn, palabraEn } from "@/lib/captions/group";
import type { Grupo } from "@/lib/captions/types";
import { IconPause, IconPlay } from "@/components/ui/icons";
import { CaptionLine } from "./CaptionLine";

export type PreviewHandle = { seek: (t: number) => void };

/**
 * 9:16 player. object-fit: cover crops the center, exactly like the export.
 * Captions follow video.currentTime on every animation frame while playing.
 */
export const CaptionPreview = forwardRef<
  PreviewHandle,
  {
    url: string;
    duracion: number;
    grupos: Grupo[];
    emojis: (string | null)[];
    estilo: EstiloSub;
    onGrupo?: (i: number) => void;
  }
>(function CaptionPreview({ url, duracion, grupos, emojis, estilo, onGrupo }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const marco = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [t, setT] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);

  useImperativeHandle(ref, () => ({
    seek: (s: number) => {
      if (!video.current) return;
      video.current.currentTime = s;
      setT(s);
    },
  }));

  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!reproduciendo) return;
    let raf = 0;
    const loop = () => {
      if (video.current) setT(video.current.currentTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reproduciendo]);

  const gi = grupoEn(grupos, t);
  const grupo = gi >= 0 ? grupos[gi] : null;
  const activa = grupo ? palabraEn(grupo, t) : 0;

  useEffect(() => {
    onGrupo?.(gi);
  }, [gi, onGrupo]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={marco}
        className="relative mx-auto aspect-[9/16] w-full max-w-[min(100%,calc(62dvh*9/16))] overflow-hidden rounded-[1.25rem] border border-line bg-black"
      >
        <video
          ref={video}
          src={url}
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
          onPlay={() => setReproduciendo(true)}
          onPause={() => setReproduciendo(false)}
          onEnded={() => setReproduciendo(false)}
          onSeeked={(e) => setT(e.currentTarget.currentTime)}
          onTimeUpdate={(e) => !reproduciendo && setT(e.currentTarget.currentTime)}
          onClick={toggle}
        />
        {grupo && ancho > 0 && (
          <CaptionLine grupo={grupo} activa={activa} estilo={estilo} ancho={ancho} emoji={emojis[gi] ?? null} />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={reproduciendo ? "Pausar" : "Reproducir"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-bg"
        >
          {reproduciendo ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
        <input
          type="range"
          min={0}
          max={duracion || 0}
          step={0.01}
          value={Math.min(t, duracion || 0)}
          onChange={(e) => {
            const s = Number(e.target.value);
            if (video.current) video.current.currentTime = s;
            setT(s);
          }}
          aria-label="Posición del video"
          className="h-11 flex-1 accent-[var(--color-accent)]"
        />
        <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted">
          {formatoTiempo(t)} / {formatoTiempo(duracion)}
        </span>
      </div>
    </div>
  );
});
