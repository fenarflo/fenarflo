import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { PLANES } from "@/lib/planes";
import { promptArmar, promptEstudio, SYSTEM_RESUMEN } from "@/lib/resumen/prompts";
import {
  ArmarRequest,
  ClaseEstudioOutput,
  ClaseVideoOutput,
  ResumenOutput,
  ShortsOutput,
  type Corte,
  type Pieza,
  type PlanResumen,
} from "@/lib/resumen/schema";
import { obtenerCuenta } from "@/lib/server/cuenta";
import { errorIA } from "@/lib/server/errores";
import { identidad, responder } from "@/lib/server/identidad";
import { claude, MODELO_TEXTO } from "@/lib/server/proveedores";
import { consumir, marcarTrabajo, verificar } from "@/lib/server/trabajo";

export const maxDuration = 60;

type Body = z.infer<typeof ArmarRequest>;

/** Keeps segments inside the video, in order, without overlaps or slivers. */
function limpiarCortes(segs: { inicio: number; fin: number; narracion: string }[], dur: number, narrador: Body["narrador"]) {
  const out: Corte[] = [];
  for (const s of [...segs].sort((a, b) => a.inicio - b.inicio)) {
    let inicio = Math.max(0, Math.min(s.inicio, dur));
    const fin = Math.max(0, Math.min(s.fin, dur));
    const prev = out[out.length - 1];
    if (prev && inicio < prev.fin) inicio = prev.fin;
    if (fin - inicio < 1.5) continue;
    out.push({ inicio, fin: Math.min(fin, inicio + 45), narracion: narrador === "no" ? "" : s.narracion.trim().slice(0, 600) });
  }
  return out;
}

const hashtags = (h: string[]) =>
  h.map((x) => x.replace(/^#+/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 6);
const marcas = (m: { inicio: number; titulo: string }[], dur: number) =>
  [...m]
    .filter((x) => x.titulo.trim())
    .map((x) => ({ inicio: Math.max(0, Math.min(Math.round(x.inicio), Math.floor(dur))), titulo: x.titulo.trim().slice(0, 80) }))
    .sort((a, b) => a.inicio - b.inicio)
    .filter((x, i, a) => i === 0 || x.inicio - a[i - 1].inicio >= 10)
    .slice(0, 14);

/** POST: picks the moments for the requested length and writes the narrator's script. */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const fail = (status: number, error: string, codigo: string) => responder({ error, codigo }, status, who.uid, nueva);

  const parsed = ArmarRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "No pudimos leer los momentos del video.", "validacion");
  const b = parsed.data;
  const t = verificar(b.token);
  if (!t || t.u !== who.uid) return fail(401, "La sesión de este video expiró. Vuelve a empezar.", "token");
  const ai = claude();
  if (!ai) return fail(500, "Falta configurar ANTHROPIC_API_KEY en el servidor.", "config");

  const c = await obtenerCuenta(who.uid);
  const maximo = PLANES[c.plan].maxResumen;
  if (b.objetivo > maximo) {
    return fail(402, `Tu plan permite resúmenes de hasta ${maximo} segundos. Elige uno más corto o mejora tu plan.`, "saldo");
  }
  if (!(await consumir(t, "armar", 1))) return fail(429, "Ya hiciste todas las versiones de este video.", "limite");

  const dur = Math.min(b.duracionVideo, t.s + 5);
  const pedir = <S extends z.ZodType>(schema: S, prompt: string, max = 8000) =>
    ai.messages
      .parse({
        model: MODELO_TEXTO,
        max_tokens: max,
        system: SYSTEM_RESUMEN,
        output_config: { effort: "low", format: zodOutputFormat(schema) },
        messages: [{ role: "user", content: prompt }],
      })
      .then((r) => (r.stop_reason === "refusal" ? null : (r.parsed_output as z.infer<S> | null)));

  try {
    let plan: PlanResumen | null = null;

    if (b.modo === "resumen") {
      const o = await pedir(ResumenOutput, promptArmar(b));
      if (o) {
        plan = {
          modo: "resumen",
          pieza: { titulo: o.titulo.trim(), cortes: limpiarCortes(o.segmentos, dur, b.narrador) },
          capitulos: marcas(o.capitulos, dur),
          textoPublicacion: o.textoPublicacion.trim(),
          hashtags: hashtags(o.hashtags),
          comentarioFijado: o.comentarioFijado.trim(),
        };
      }
    } else if (b.modo === "clase") {
      const [v, e] = await Promise.all([
        pedir(ClaseVideoOutput, promptArmar(b)),
        pedir(ClaseEstudioOutput, promptEstudio(b), 10000).catch((err) => {
          console.error("Material de estudio", err);
          return null;
        }),
      ]);
      if (v) {
        plan = {
          modo: "clase",
          pieza: { titulo: v.titulo.trim(), cortes: limpiarCortes(v.segmentos, dur, b.narrador) },
          momentosClave: marcas(v.momentosClave, dur),
          apuntes: (e?.apuntes ?? []).slice(0, 10),
          conceptos: (e?.conceptos ?? []).slice(0, 14),
          quiz: (e?.quiz ?? [])
            .filter((q) => q.opciones.length >= 2)
            .map((q) => ({ ...q, opciones: q.opciones.slice(0, 4), correcta: Math.max(0, Math.min(Math.round(q.correcta), Math.min(3, q.opciones.length - 1))) }))
            .slice(0, 6),
        };
      }
    } else {
      const o = await pedir(ShortsOutput, promptArmar(b));
      if (o) {
        const piezas: Pieza[] = o.shorts
          .map((s) => ({
            titulo: s.titulo.trim(),
            cortes: limpiarCortes(s.segmentos, dur, b.narrador),
            caption: s.caption.trim(),
            hashtags: hashtags(s.hashtags),
            comentarioFijado: s.comentarioFijado.trim(),
            autonomo: s.autonomo,
            porque: s.porque.trim(),
          }))
          .filter((p) => p.cortes.length)
          .slice(0, 5);
        if (piezas.length) plan = { modo: "shorts", piezas };
      }
    }

    const vacio = !plan || (plan.modo === "shorts" ? !plan.piezas.length : !plan.pieza.cortes.length);
    if (vacio) {
      await consumir(t, "armar", -1);
      return fail(422, "No encontramos suficiente contenido hablado para resumir este video.", "ia");
    }
    await marcarTrabajo(t.j, { armado: 1 });
    return responder({ plan }, 200, who.uid, nueva);
  } catch (e) {
    await consumir(t, "armar", -1);
    const r = errorIA(e);
    return fail(r.status, r.error, r.codigo);
  }
}
