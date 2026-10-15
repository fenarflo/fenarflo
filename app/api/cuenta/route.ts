import type { NextRequest } from "next/server";
import { guardarReferido, obtenerCuenta, publica, uidPorCodigo } from "@/lib/server/cuenta";
import { identidad, responder } from "@/lib/server/identidad";
import { claude, proveedorTranscripcion, vozDisponible } from "@/lib/server/proveedores";

/** GET: plan, minutes left, codes, and which services this deployment has configured. */
export async function GET(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const c = await obtenerCuenta(who.uid);
  return responder(
    {
      cuenta: publica(c),
      servicios: { ia: !!claude(), transcripcion: !!proveedorTranscripcion(), voz: vozDisponible() },
    },
    200,
    who.uid,
    nueva,
  );
}

/**
 * POST { accion: "vincular", codigo } opens an existing account on this device.
 * POST { accion: "referido", ref } remembers who invited this person.
 */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  let body: { accion?: string; codigo?: string; ref?: string };
  try {
    body = await req.json();
  } catch {
    return responder({ error: "No pudimos leer la solicitud." }, 400, who.uid, nueva);
  }

  if (body.accion === "vincular" && typeof body.codigo === "string") {
    const uid = await uidPorCodigo(body.codigo);
    if (!uid) return responder({ error: "Ese código no existe. Revísalo e intenta de nuevo." }, 404, who.uid, nueva);
    const c = await obtenerCuenta(uid);
    return responder({ cuenta: publica(c) }, 200, uid, true);
  }

  if (body.accion === "referido" && typeof body.ref === "string") {
    const ok = await guardarReferido(who.uid, body.ref);
    return responder({ ok }, 200, who.uid, nueva);
  }

  return responder({ error: "Acción no válida." }, 400, who.uid, nueva);
}
