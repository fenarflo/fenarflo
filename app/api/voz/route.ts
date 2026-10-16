import type { NextRequest } from "next/server";
import { instruccionVoz } from "@/lib/resumen/prompts";
import { VozRequest } from "@/lib/resumen/schema";
import { identidad, responder } from "@/lib/server/identidad";
import { ErrorProveedor, sintetizar, vozDisponible } from "@/lib/server/proveedores";
import { consumir, verificar } from "@/lib/server/trabajo";

export const maxDuration = 60;

/** POST { token, texto, voz, modo }: one narration line as MP3. */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const fail = (status: number, error: string, codigo: string) => responder({ error, codigo }, status, who.uid, nueva);

  const parsed = VozRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "Texto de narración no válido.", "validacion");
  const b = parsed.data;
  const t = verificar(b.token);
  if (!t || t.u !== who.uid) return fail(401, "La sesión de este video expiró. Vuelve a empezar.", "token");
  if (!vozDisponible()) return fail(500, "La voz no está configurada (falta OPENAI_API_KEY). Usa el narrador en texto.", "config");
  if (!(await consumir(t, "voz", b.texto.length))) return fail(429, "Este video ya usó toda su narración.", "limite");

  try {
    const mp3 = await sintetizar(b.texto, b.voz, instruccionVoz(b.modo));
    return new Response(mp3, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    await consumir(t, "voz", -b.texto.length);
    if (e instanceof ErrorProveedor && e.status === 402) {
      return fail(402, "La cuenta de OpenAI no tiene saldo: carga créditos en platform.openai.com → Billing.", "config");
    }
    if (e instanceof ErrorProveedor && e.status === 429) return fail(503, "Mucha demanda en la voz. Reintentando…", "ia");
    console.error(e);
    return fail(502, "No se pudo generar la voz.", "ia");
  }
}
