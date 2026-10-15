import type { NextRequest } from "next/server";
import { MAX_VIDEO_MIN, minutosDe } from "@/lib/planes";
import { TrabajoRequest } from "@/lib/resumen/schema";
import { SinMinutos, devolver, obtenerCuenta, publica, reservar } from "@/lib/server/cuenta";
import { identidad, responder } from "@/lib/server/identidad";
import { claude, proveedorTranscripcion } from "@/lib/server/proveedores";
import { estadoTrabajo, firmar, marcarTrabajo, verificar } from "@/lib/server/trabajo";
import { kv } from "@/lib/server/kv";

/** POST { duracion, modo }: charges the video's minutes and returns the job token. */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const fail = (status: number, error: string, codigo: string) => responder({ error, codigo }, status, who.uid, nueva);

  const parsed = TrabajoRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "No pudimos leer los datos del video.", "validacion");
  if (!claude() || !proveedorTranscripcion()) {
    return fail(
      500,
      "Falta configurar el servidor: ANTHROPIC_API_KEY y GROQ_API_KEY (u OPENAI_API_KEY) en las variables de entorno.",
      "config",
    );
  }
  const { duracion, modo } = parsed.data;
  const minutos = minutosDe(duracion);
  if (minutos > MAX_VIDEO_MIN) {
    return fail(400, `Tu video dura ${minutos} min y el máximo es ${MAX_VIDEO_MIN / 60} horas. Recórtalo en partes.`, "validacion");
  }

  const c = await obtenerCuenta(who.uid);
  let reserva;
  try {
    reserva = await reservar(c, who.ip, minutos);
  } catch (e) {
    if (e instanceof SinMinutos) {
      const disp = c.incl + c.extra;
      return fail(
        402,
        e.codigo === "ip"
          ? "Ya se usaron los minutos gratis de esta red este mes. Consigue más minutos para seguir."
          : `Este video necesita ${minutos} min y te quedan ${disp}. Consigue más minutos para seguir.`,
        "saldo",
      );
    }
    throw e;
  }

  const j = crypto.randomUUID();
  await marcarTrabajo(j, { uid: who.uid, incl: reserva.incl, extra: reserva.extra, minutos });
  const token = firmar({ j, u: who.uid, s: Math.ceil(duracion), m: modo });
  const despues = await obtenerCuenta(who.uid);
  return responder({ token, minutos, cuenta: publica(despues) }, 200, who.uid, nueva);
}

/** DELETE { token }: the job failed before the summary was written, so give the minutes back. */
export async function DELETE(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const t = verificar(body?.token);
  if (!t || t.u !== who.uid) return responder({ ok: false }, 400, who.uid, nueva);
  const e = await estadoTrabajo(t.j);
  // Once a plan was written the work was delivered; refund only once.
  if (e.armado || !(await kv.set(`hk:devuelto:${t.j}`, 1, { nx: true, ex: 86400 }))) {
    return responder({ ok: false }, 200, who.uid, nueva);
  }
  await devolver(who.uid, { incl: Number(e.incl ?? 0), extra: Number(e.extra ?? 0) });
  return responder({ ok: true, cuenta: publica(await obtenerCuenta(who.uid)) }, 200, who.uid, nueva);
}
