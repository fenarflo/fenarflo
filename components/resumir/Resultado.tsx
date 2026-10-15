"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { resolverEstilo } from "@/lib/captions/estilos";
import { formatoTiempo } from "@/lib/captions/group";
import type { EstiloSubId } from "@/lib/captions/types";
import { usePlan, useCuenta } from "@/lib/cuenta";
import { estiloPersonalizado, useEstilo } from "@/lib/estilo";
import { spring } from "@/lib/motion";
import { exportarResumen, type OpcionesRender } from "@/lib/resumen/render";
import { OBJETIVOS, resumen, useResumen } from "@/lib/resumen/sesion";
import { usePersistentState } from "@/lib/storage";
import { mb } from "@/lib/video/limits";
import { StylePicker } from "@/components/subtitulos/StylePicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconDownload, IconRefresh, IconShare } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Segmented } from "@/components/ui/Segmented";
import { ExtrasClase, ExtrasResumen, ExtrasShort } from "./Extras";
import { Reproductor } from "./Reproductor";
import { etiquetaDuracion } from "./ResumirScreen";

function nombreArchivo(titulo: string, ext: string) {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
  return `${base || "resumen"}-hookly.${ext}`;
}

export function Resultado() {
  const s = useResumen();
  const { isPro } = usePlan();
  const { cuenta } = useCuenta();
  const [miEstilo] = useEstilo();
  const [estiloId, setEstiloId] = usePersistentState<EstiloSubId>("resumen-estilo", "bold");
  const [alto, setAlto] = useState<720 | 1080>(720);
  const r = s.resultado!;
  const piezas = r.piezas;
  const i = Math.min(s.seleccion, piezas.length - 1);
  const pieza = piezas[i];
  const narrador = r.opciones.narrador;

  const opciones: OpcionesRender = useMemo(
    () => ({
      formato: s.prefs.formato,
      encuadre: s.prefs.encuadre,
      alto: alto === 1080 && isPro ? 1080 : 720,
      marca: cuenta?.marcaDeAgua ?? true,
      estilo: resolverEstilo(estiloId, miEstilo),
      narrador,
      titulo: pieza.titulo,
    }),
    [s.prefs.formato, s.prefs.encuadre, alto, isPro, cuenta?.marcaDeAgua, estiloId, miEstilo, narrador, pieza.titulo],
  );

  const exportado = s.exportados[i];
  const exportando = s.exportando?.pieza === i ? s.exportando : undefined;
  const otroExportando = !!s.exportando && !exportando;

  const exportar = () => {
    if (!s.url || s.exportando) return;
    // Synchronous on purpose: iOS only allows audio set-up inside the tap.
    const job = exportarResumen({ url: s.url, pieza, palabras: r.palabras, opciones, onProgreso: resumen.progresoExport });
    resumen.empezarExport(i, job.cancelar);
    job.promesa
      .then((e) => resumen.terminarExport(i, { ...e, nombre: nombreArchivo(pieza.titulo, e.ext) }))
      .catch((e) => {
        const cancelado = (e as Error)?.name === "AbortError";
        resumen.terminarExport(
          i,
          null,
          cancelado ? undefined : (e as Error)?.message && (e as Error).message !== "video" ? (e as Error).message : "No pudimos exportar. Prueba de nuevo con la pantalla encendida.",
        );
      });
  };

  const compartir = async () => {
    if (!exportado) return;
    try {
      const file = new File([exportado.blob], exportado.nombre, { type: exportado.blob.type });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: pieza.titulo });
    } catch {
      /* dismissed */
    }
  };
  const puedeCompartir = typeof navigator !== "undefined" && "canShare" in navigator;
  const duracionTotal = pieza.cortes.reduce((n, c) => n + c.fin - c.inicio, 0);

  return (
    <div className="flex flex-col gap-5">
      {r.avisos.map((a) => (
        <p key={a} className="rounded-2xl border border-line bg-card-2 p-3 text-sm text-muted">
          {a}
        </p>
      ))}

      {piezas.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Shorts">
          {piezas.map((p, k) => (
            <Chip key={k} selected={k === i} onClick={() => resumen.seleccionar(k)}>
              Short {k + 1}
            </Chip>
          ))}
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="t-title">{pieza.titulo || "Tu resumen"}</h2>
          <p className="t-caption mt-1">
            {pieza.cortes.length} momentos de todo el video · {etiquetaDuracion(Math.round(duracionTotal))}
            {narrador === "voz" ? " · narrado" : narrador === "texto" ? " · narración en texto" : ""}
          </p>
        </div>

        {s.url && <Reproductor url={s.url} pieza={pieza} palabras={r.palabras} opciones={opciones} />}

        <div className="flex flex-col gap-2.5">
          <span className="t-label">Subtítulos</span>
          <StylePicker value={estiloId} onChange={setEstiloId} miEstilo={miEstilo} personalizado={estiloPersonalizado(miEstilo)} />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="t-label">Calidad</span>
          <Segmented
            label="Calidad"
            value={alto === 1080 && isPro ? "1080" : "720"}
            onChange={(v) => (v === "1080" && !isPro ? null : setAlto(Number(v) as 720 | 1080))}
            options={[
              { id: "720", label: "720p" },
              { id: "1080", label: isPro ? "1080p" : "1080p · Pro" },
            ]}
          />
          {opciones.marca && (
            <p className="t-caption">
              El plan Gratis agrega la marca &ldquo;hecho con hookly&rdquo;.{" "}
              <Link href="/cuenta" className="font-semibold text-accent">
                Quitarla
              </Link>
            </p>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {exportando ? (
            <motion.div key="ex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring} className="flex flex-col gap-3">
              <ProgressBar
                value={exportando.progreso}
                label="Armando tu video"
                detail="Se graba en tiempo real: tarda lo que dura el resumen. Deja la pantalla encendida."
              />
              <Button variant="secondary" block onClick={resumen.cancelarExport}>
                Cancelar
              </Button>
            </motion.div>
          ) : exportado ? (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Tu video está listo</span>
                <span className="t-caption">{mb(exportado.blob.size)} MB</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {puedeCompartir && (
                  <Button onClick={compartir}>
                    <IconShare size={18} />
                    Guardar o compartir
                  </Button>
                )}
                <a
                  href={exportado.url}
                  download={exportado.nombre}
                  className={
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-[0.9375rem] font-semibold " +
                    (puedeCompartir ? "border border-line bg-card-2 text-ink" : "col-span-2 bg-accent text-accent-ink")
                  }
                >
                  <IconDownload size={18} />
                  Descargar
                </a>
              </div>
              <Button variant="ghost" block onClick={exportar}>
                Exportar de nuevo
              </Button>
            </motion.div>
          ) : (
            <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <Button block className="min-h-13 text-base" onClick={exportar} disabled={otroExportando}>
                <IconDownload size={19} />
                Exportar video
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {r.plan.modo === "shorts" && <ExtrasShort pieza={pieza} />}

      <Card className="flex flex-col gap-3">
        <h3 className="font-semibold">Los momentos que elegimos</h3>
        <ol className="flex flex-col gap-3">
          {pieza.cortes.map((c, k) => (
            <li key={k} className="flex gap-3 text-sm">
              <span className="w-[5.5rem] shrink-0 tabular-nums text-faint">
                {formatoTiempo(c.inicio)}–{formatoTiempo(c.fin)}
              </span>
              <span className="text-muted">{c.narracion || "Fragmento original"}</span>
            </li>
          ))}
        </ol>
      </Card>

      {r.plan.modo === "clase" && <ExtrasClase plan={r.plan} titulo={pieza.titulo} />}
      {r.plan.modo === "resumen" && <ExtrasResumen plan={r.plan} />}

      <Card className="flex flex-col gap-3">
        <h3 className="font-semibold">¿Otra versión?</h3>
        <p className="text-sm text-muted">Usa la misma transcripción: no gasta minutos.</p>
        <div className="flex flex-wrap gap-2">
          {OBJETIVOS[r.opciones.modo]
            .filter((o) => o <= (cuenta?.maxResumen ?? 60))
            .map((o) => (
              <Chip key={o} selected={o === r.opciones.objetivo} onClick={() => resumen.rehacer({ objetivo: o })}>
                {etiquetaDuracion(o)}
              </Chip>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => resumen.rehacer({})}>
            <IconRefresh size={18} />
            Otro ángulo
          </Button>
          <Button
            variant="secondary"
            onClick={() => resumen.rehacer({ narrador: narrador === "voz" ? "texto" : "voz" })}
          >
            {narrador === "voz" ? "Narrar en texto" : "Narrar con voz"}
          </Button>
        </div>
        <Button variant="ghost" block onClick={resumen.reiniciar}>
          Resumir otro video
        </Button>
      </Card>
    </div>
  );
}
