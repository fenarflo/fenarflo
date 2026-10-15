"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { snappy } from "@/lib/motion";
import type { PiezaLista } from "@/lib/resumen/pipeline";
import type { PlanResumen } from "@/lib/resumen/schema";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { IconCheck, IconClose, IconDownload } from "@/components/ui/icons";

type PlanClase = Extract<PlanResumen, { modo: "clase" }>;
type PlanRes = Extract<PlanResumen, { modo: "resumen" }>;

/** h:mm:ss past an hour, as YouTube chapters expect. */
function formatoTiempo(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

const conHashtags = (texto: string, h: string[] = []) => [texto, h.map((x) => "#" + x).join(" ")].filter(Boolean).join("\n\n");

function Bloque({ titulo, copiar, children }: { titulo: string; copiar?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{titulo}</h3>
        {copiar && <CopyButton text={copiar} compact />}
      </div>
      {children}
    </Card>
  );
}

export function ExtrasShort({ pieza }: { pieza: PiezaLista }) {
  return (
    <>
      <div
        className={
          "flex gap-2.5 rounded-2xl border p-3.5 text-sm " +
          (pieza.autonomo ? "border-accent/40 bg-accent/10" : "border-line bg-card-2")
        }
      >
        {pieza.autonomo ? (
          <IconCheck size={18} className="mt-0.5 shrink-0 text-accent" />
        ) : (
          <IconClose size={18} className="mt-0.5 shrink-0 text-muted" />
        )}
        <p>
          <span className="font-semibold">{pieza.autonomo ? "Se entiende sin contexto." : "Necesita contexto."}</span>{" "}
          <span className="text-muted">
            {pieza.porque || (pieza.autonomo ? "Quien no vio el video completo lo entiende." : "El narrador da el contexto al inicio.")}
          </span>
        </p>
      </div>
      {pieza.caption && (
        <Bloque titulo="Texto para publicar" copiar={conHashtags(pieza.caption, pieza.hashtags)}>
          <p className="whitespace-pre-line text-[0.9375rem]">{pieza.caption}</p>
          {!!pieza.hashtags?.length && <p className="text-sm text-accent">{pieza.hashtags.map((h) => "#" + h).join(" ")}</p>}
        </Bloque>
      )}
      {pieza.comentarioFijado && (
        <Bloque titulo="Comentario para fijar" copiar={pieza.comentarioFijado}>
          <p className="text-[0.9375rem] text-muted">{pieza.comentarioFijado}</p>
        </Bloque>
      )}
    </>
  );
}

export function ExtrasResumen({ plan }: { plan: PlanRes }) {
  const capitulos = plan.capitulos.map((c) => `${formatoTiempo(c.inicio)} ${c.titulo}`).join("\n");
  return (
    <>
      {plan.capitulos.length >= 3 && (
        <Bloque titulo="Capítulos para YouTube" copiar={capitulos}>
          <p className="t-caption -mt-1">Pégalos en la descripción del video original para que YouTube muestre capítulos.</p>
          <pre className="whitespace-pre-wrap font-sans text-sm tabular-nums text-muted">{capitulos}</pre>
        </Bloque>
      )}
      {plan.textoPublicacion && (
        <Bloque titulo="Texto para publicar" copiar={conHashtags(plan.textoPublicacion, plan.hashtags)}>
          <p className="text-[0.9375rem]">{plan.textoPublicacion}</p>
          {!!plan.hashtags.length && <p className="text-sm text-accent">{plan.hashtags.map((h) => "#" + h).join(" ")}</p>}
        </Bloque>
      )}
      {plan.comentarioFijado && (
        <Bloque titulo="Comentario para fijar" copiar={plan.comentarioFijado}>
          <p className="text-[0.9375rem] text-muted">{plan.comentarioFijado}</p>
        </Bloque>
      )}
    </>
  );
}

function Pregunta({ q, n }: { q: PlanClase["quiz"][number]; n: number }) {
  const [elegida, setElegida] = useState<number | null>(null);
  return (
    <li className="flex flex-col gap-2">
      <p className="font-semibold">
        {n}. {q.pregunta}
      </p>
      <div className="flex flex-col gap-1.5" role="group" aria-label={`Pregunta ${n}`}>
        {q.opciones.map((o, k) => {
          const respondida = elegida !== null;
          const correcta = k === q.correcta;
          const marcada = k === elegida;
          return (
            <motion.button
              key={k}
              type="button"
              disabled={respondida}
              whileTap={respondida ? undefined : { scale: 0.98 }}
              transition={snappy}
              onClick={() => setElegida(k)}
              className={
                "min-h-11 rounded-xl border px-3.5 py-2 text-left text-[0.9375rem] transition-colors duration-150 " +
                (respondida && correcta
                  ? "border-accent bg-accent/15 text-ink"
                  : respondida && marcada
                    ? "border-danger/50 bg-danger/10"
                    : "border-line bg-card-2 " + (respondida ? "opacity-60" : "hover:border-faint"))
              }
            >
              {o}
            </motion.button>
          );
        })}
      </div>
      {elegida !== null && (
        <p className="text-sm text-muted" role="status">
          <span className={elegida === q.correcta ? "font-semibold text-accent" : "font-semibold text-danger"}>
            {elegida === q.correcta ? "Correcto. " : "No exactamente. "}
          </span>
          {q.explicacion}
        </p>
      )}
    </li>
  );
}

export function ExtrasClase({ plan, titulo }: { plan: PlanClase; titulo: string }) {
  const md = useMemo(() => {
    const partes = [`# ${titulo || "Apuntes"}`];
    for (const a of plan.apuntes) partes.push(`\n## ${a.titulo}\n` + a.puntos.map((p) => `- ${p}`).join("\n"));
    if (plan.conceptos.length) partes.push("\n## Conceptos clave\n" + plan.conceptos.map((c) => `- **${c.termino}**: ${c.definicion}`).join("\n"));
    if (plan.momentosClave.length) partes.push("\n## Momentos de la clase\n" + plan.momentosClave.map((m) => `- ${formatoTiempo(m.inicio)} ${m.titulo}`).join("\n"));
    if (plan.quiz.length) {
      partes.push(
        "\n## Quiz\n" +
          plan.quiz
            .map((q, i) => `${i + 1}. ${q.pregunta}\n` + q.opciones.map((o, k) => `   ${"abcd"[k]}) ${o}`).join("\n") + `\n   Respuesta: ${"abcd"[q.correcta]}) ${q.explicacion}`)
            .join("\n\n"),
      );
    }
    return partes.join("\n") + "\n\nHecho con Hookly\n";
  }, [plan, titulo]);
  const archivo = useMemo(() => URL.createObjectURL(new Blob([md], { type: "text/markdown" })), [md]);

  return (
    <>
      {!!plan.apuntes.length && (
        <Bloque titulo="Apuntes" copiar={md}>
          <div className="flex flex-col gap-4">
            {plan.apuntes.map((a, k) => (
              <section key={k}>
                <h4 className="text-[0.9375rem] font-semibold text-accent">{a.titulo}</h4>
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-[0.9375rem] text-muted">
                  {a.puntos.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <a
            href={archivo}
            download={`${(titulo || "apuntes").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "apuntes"}.md`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-card-2 px-4 text-[0.9375rem] font-semibold"
          >
            <IconDownload size={18} />
            Descargar apuntes
          </a>
        </Bloque>
      )}

      {!!plan.conceptos.length && (
        <Bloque titulo="Conceptos clave">
          <dl className="flex flex-col gap-3">
            {plan.conceptos.map((c, k) => (
              <div key={k}>
                <dt className="font-semibold">{c.termino}</dt>
                <dd className="text-[0.9375rem] text-muted">{c.definicion}</dd>
              </div>
            ))}
          </dl>
        </Bloque>
      )}

      {!!plan.quiz.length && (
        <Bloque titulo="Ponte a prueba">
          <ol className="flex flex-col gap-5">
            {plan.quiz.map((q, k) => (
              <Pregunta key={k} q={q} n={k + 1} />
            ))}
          </ol>
        </Bloque>
      )}

      {!!plan.momentosClave.length && (
        <Bloque titulo="Momentos de la clase" copiar={plan.momentosClave.map((m) => `${formatoTiempo(m.inicio)} ${m.titulo}`).join("\n")}>
          <ul className="flex flex-col gap-2 text-sm">
            {plan.momentosClave.map((m, k) => (
              <li key={k} className="flex gap-3">
                <span className="w-12 shrink-0 tabular-nums text-faint">{formatoTiempo(m.inicio)}</span>
                <span className="text-muted">{m.titulo}</span>
              </li>
            ))}
          </ul>
        </Bloque>
      )}
    </>
  );
}
