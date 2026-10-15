"use client";

import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { emojisPorGrupo } from "@/lib/captions/emojis";
import { resolverEstilo } from "@/lib/captions/estilos";
import { agrupar, formatoTiempo, reemplazarGrupo } from "@/lib/captions/group";
import type { Grupo } from "@/lib/captions/types";
import { estiloPersonalizado, useEstilo } from "@/lib/estilo";
import { usePlan } from "@/lib/cuenta";
import { MAX_DURACION_S, maxBytes, mb } from "@/lib/video/limits";
import { sesion, useSesion } from "@/lib/video/sesion";
import { useHydrated } from "@/lib/storage";
import { PageHeader } from "@/components/nav/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconCaptions, IconDownload, IconRefresh, IconShare, IconUpload } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { CaptionPreview, type PreviewHandle } from "./CaptionPreview";
import { LineEditor } from "./LineEditor";
import { StylePicker } from "./StylePicker";
import { ExportProgress } from "./ExportProgress";
import { ErrorCard } from "@/components/ui/ErrorCard";

function Selector({ cargando }: { cargando: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const hidratado = useHydrated();
  const limite = hidratado ? mb(maxBytes()) : null;

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
        if (f) sesion.elegir(f);
      }}
      className={
        "flex flex-col items-center rounded-[var(--radius-card)] border border-dashed px-6 py-10 text-center transition-colors duration-150 " +
        (arrastrando ? "border-accent bg-accent/5" : "border-line bg-card")
      }
    >
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-card-2 text-accent">
        <IconCaptions size={28} />
      </span>
      <h2 className="t-title">Sube tu video</h2>
      <p className="mt-1.5 max-w-[30ch] text-sm text-muted">
        Se transcribe en tu dispositivo. Tu video no se sube a ningún servidor.
      </p>
      <input
        ref={input}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) sesion.elegir(f);
          e.target.value = "";
        }}
      />
      <Button className="mt-6 px-6" onClick={() => input.current?.click()} disabled={cargando}>
        {cargando ? <span className="spinner" aria-hidden="true" /> : <IconUpload size={19} />}
        {cargando ? "Revisando video…" : "Elegir video"}
      </Button>
      <p className="t-caption mt-4">
        MP4, MOV o WebM · hasta {MAX_DURACION_S / 60} min{limite ? ` · hasta ${limite} MB` : ""}
      </p>
    </div>
  );
}

export function SubtitulosScreen() {
  const s = useSesion();
  const [miEstilo] = useEstilo();
  const { isPro } = usePlan();
  const preview = useRef<PreviewHandle>(null);
  const [grupoActivo, setGrupoActivo] = useState(-1);

  const grupos = useMemo(() => agrupar(s.palabras), [s.palabras]);
  const emojis = useMemo(
    () => (s.emojis ? emojisPorGrupo(grupos) : grupos.map(() => null)),
    [grupos, s.emojis],
  );
  const estilo = useMemo(() => resolverEstilo(s.estiloId, miEstilo), [s.estiloId, miEstilo]);

  const onSeek = useCallback((t: number) => preview.current?.seek(t + 0.01), []);
  const onEditar = useCallback(
    (g: Grupo, texto: string) => sesion.setPalabras(reemplazarGrupo(s.palabras, g, texto)),
    [s.palabras],
  );

  const compartir = async () => {
    if (!s.resultado) return;
    try {
      const blob = await fetch(s.resultado.url).then((r) => r.blob());
      const file = new File([blob], s.resultado.nombre, { type: "video/mp4" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    } catch {
      /* person dismissed the share sheet */
    }
  };
  const puedeCompartir =
    typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator;

  return (
    <>
      <PageHeader
        title="Subtítulos"
        subtitle="Animados palabra por palabra, listos para 9:16."
      />

      <AnimatePresence>
        {s.error && <ErrorCard mensaje={s.error} onClose={sesion.limpiarError} />}
      </AnimatePresence>

      {(s.fase === "vacio" || s.fase === "validando") && <Selector cargando={s.fase === "validando"} />}

      {(s.fase === "listo" || s.fase === "transcribiendo") && s.url && s.info && (
        <Card className="flex flex-col gap-5">
          <div className="flex gap-4">
            <video
              src={s.url}
              muted
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-24 shrink-0 rounded-xl bg-black object-cover"
            />
            <div className="min-w-0 flex-1 py-1">
              <p className="truncate font-semibold">{s.file?.name}</p>
              <p className="t-caption mt-1">
                {formatoTiempo(s.info.duracion)} · {mb(s.file?.size ?? 0)} MB
              </p>
              {s.fase === "listo" && (
                <button
                  type="button"
                  onClick={sesion.reiniciar}
                  className="mt-2 min-h-11 text-sm font-semibold text-muted hover:text-ink"
                >
                  Cambiar video
                </button>
              )}
            </div>
          </div>

          {s.fase === "listo" ? (
            <>
              <p className="text-sm text-muted">
                La primera vez se descarga el modelo de voz (unos 140 MB) y queda guardado en tu navegador.
                Mientras transcribe, mantén esta pestaña abierta.
              </p>
              <Button block className="min-h-13 text-base" onClick={() => sesion.transcribir()}>
                Transcribir
              </Button>
            </>
          ) : (
            <TranscribeProgress />
          )}
        </Card>
      )}

      {(s.fase === "editor" || s.fase === "exportando" || s.fase === "exportado") && s.url && s.info && (
        <div className="flex flex-col gap-5">
          {s.fase === "exportado" && s.resultado ? (
            <Card className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h2 className="t-title">Tu video está listo</h2>
                <span className="t-caption">{mb(s.resultado.bytes)} MB</span>
              </div>
              <video
                src={s.resultado.url}
                controls
                playsInline
                className="mx-auto aspect-[9/16] w-full max-w-[min(100%,calc(55dvh*9/16))] rounded-2xl bg-black"
              />
              <div className="flex gap-2">
                <a
                  href={s.resultado.url}
                  download={s.resultado.nombre}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-accent-ink"
                >
                  <IconDownload size={19} />
                  Descargar
                </a>
                {puedeCompartir && (
                  <Button variant="secondary" className="min-h-12" onClick={compartir}>
                    <IconShare size={19} />
                    Compartir
                  </Button>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={sesion.volverAlEditor}>
                  Volver a editar
                </Button>
                <Button variant="ghost" onClick={sesion.reiniciar}>
                  <IconRefresh size={17} />
                  Otro video
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <CaptionPreview
                ref={preview}
                url={s.url}
                duracion={s.info.duracion}
                grupos={grupos}
                emojis={emojis}
                estilo={estilo}
                onGrupo={setGrupoActivo}
              />

              <Card className="flex flex-col gap-4">
                <h2 className="t-label">Estilo</h2>
                <StylePicker
                  value={s.estiloId}
                  onChange={sesion.setEstilo}
                  miEstilo={miEstilo}
                  personalizado={estiloPersonalizado(miEstilo)}
                />
                <div className="h-px bg-line" />
                <Switch
                  checked={s.emojis}
                  onChange={sesion.setEmojis}
                  label="Emojis automáticos"
                  description="Agrega uno de vez en cuando según lo que dices"
                />
              </Card>

              {s.fase === "exportando" ? (
                <ExportProgress avance={s.avanceE} />
              ) : (
                <Card className="flex flex-col gap-4">
                  <h2 className="t-label">Exportar 9:16</h2>
                  <Segmented
                    label="Calidad"
                    value={String(s.calidad) as "720" | "1080"}
                    onChange={(v) => (v === "1080" && !isPro ? null : sesion.setCalidad(Number(v) as 720 | 1080))}
                    options={[
                      { id: "720", label: "720p" },
                      { id: "1080", label: isPro ? "1080p" : "1080p · Pro" },
                    ]}
                  />
                  {!isPro && (
                    <p className="text-sm text-muted">
                      El plan gratis agrega la marca de agua &ldquo;hookly&rdquo;.{" "}
                      <Link href="/cuenta" className="font-semibold text-accent">
                        Quitarla con Pro
                      </Link>
                    </p>
                  )}
                  <Button
                    block
                    className="min-h-13 text-base"
                    onClick={() => sesion.exportar({ estilo, marcaDeAgua: !isPro })}
                  >
                    <IconDownload size={19} />
                    Exportar video
                  </Button>
                  <p className="t-caption -mt-1 text-center">
                    Se procesa en tu dispositivo. Puede tardar varios minutos en videos largos.
                  </p>
                </Card>
              )}

              <Card>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="t-label">Editar texto</h2>
                  <span className="t-caption">{grupos.length} líneas</span>
                </div>
                <LineEditor
                  grupos={grupos}
                  activo={grupoActivo}
                  emojis={emojis}
                  onSeek={onSeek}
                  onEditar={onEditar}
                />
              </Card>

              <Button variant="ghost" onClick={sesion.reiniciar} className="self-center">
                <IconRefresh size={17} />
                Empezar con otro video
              </Button>
            </>
          )}
        </div>
      )}
    </>
  );
}

function TranscribeProgress() {
  const s = useSesion();
  const a = s.avanceT;
  const ultimas = a?.fase === "transcribiendo" ? a.palabras.slice(-14).map((p) => p.text).join(" ") : "";
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {!a || a.fase === "audio" ? (
        <ProgressBar value={0} indeterminate label="Leyendo el audio…" />
      ) : a.fase === "descarga" ? (
        <ProgressBar
          value={a.progreso}
          label="Descargando modelo de voz"
          detail="Solo la primera vez. Después queda guardado en tu navegador."
        />
      ) : (
        <ProgressBar value={a.progreso} label="Transcribiendo" detail="Todo sucede en tu dispositivo." />
      )}
      {ultimas && (
        <p className="line-clamp-2 rounded-xl bg-bg px-3 py-2 text-sm text-muted">&hellip;{ultimas}</p>
      )}
      <Button variant="secondary" onClick={sesion.cancelarTranscripcion}>
        Cancelar
      </Button>
    </div>
  );
}
