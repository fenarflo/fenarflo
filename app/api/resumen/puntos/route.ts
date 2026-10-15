import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { NextRequest } from "next/server";
import { promptPuntos, SYSTEM_RESUMEN } from "@/lib/resumen/prompts";
import { PuntosOutput, PuntosRequest } from "@/lib/resumen/schema";
import { errorIA } from "@/lib/server/errores";
import { identidad, responder } from "@/lib/server/identidad";
import { claude, MODELO_TEXTO } from "@/lib/server/proveedores";
import { consumir, verificar } from "@/lib/server/trabajo";

export const maxDuration = 60;

/** POST: the key moments of one stretch (~6 min) of the transcript. Called in parallel. */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const fail = (status: number, error: string, codigo: string) => responder({ error, codigo }, status, who.uid, nueva);

  const parsed = PuntosRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "Tramo de transcripción no válido.", "validacion");
  const b = parsed.data;
  const t = verificar(b.token);
  if (!t || t.u !== who.uid) return fail(401, "La sesión de este video expiró. Vuelve a empezar.", "token");
  const ai = claude();
  if (!ai) return fail(500, "Falta configurar ANTHROPIC_API_KEY en el servidor.", "config");
  if (!(await consumir(t, "puntos", 1))) return fail(429, "Este video ya usó todos sus análisis.", "limite");

  try {
    const res = await ai.messages.parse({
      model: MODELO_TEXTO,
      max_tokens: 4000,
      system: SYSTEM_RESUMEN,
      output_config: { effort: "low", format: zodOutputFormat(PuntosOutput) },
      messages: [{ role: "user", content: promptPuntos(b.modo, b.inicio, b.fin, b.lineas) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return responder({ resumen: "", momentos: [] }, 200, who.uid, nueva);
    }
    const { resumen, momentos } = res.parsed_output;
    const limpios = momentos
      .map((m) => ({
        ...m,
        inicio: Math.max(b.inicio, Math.min(m.inicio, b.fin)),
        fin: Math.max(b.inicio, Math.min(m.fin, b.fin + 3)),
        importancia: Math.round(Math.min(5, Math.max(1, m.importancia || 3))),
        cita: m.cita.slice(0, 400),
        idea: m.idea.slice(0, 300),
      }))
      .filter((m) => m.fin - m.inicio >= 2)
      .slice(0, 10);
    return responder({ resumen: resumen.slice(0, 1200), momentos: limpios }, 200, who.uid, nueva);
  } catch (e) {
    await consumir(t, "puntos", -1);
    const r = errorIA(e);
    return fail(r.status, r.error, r.codigo);
  }
}
