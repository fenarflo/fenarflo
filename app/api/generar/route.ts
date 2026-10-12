import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { NextRequest } from "next/server";
import { promptGuion, promptHooks, SYSTEM } from "@/lib/ai/prompts";
import {
  GenerarRequest,
  GuionOutput,
  HooksOutput,
  TIPOS_HOOK,
  type ErrorResponse,
  type GuionResponse,
  type HooksResponse,
} from "@/lib/ai/schema";
import { consultarUso, publico, registrarUso, type Identidad } from "@/lib/rate-limit";

/* The only place that talks to the text model. The API key never leaves the server. */

export const maxDuration = 60;

// Cheap and fast; effort "low" keeps latency and cost down for short creative text.
const MODEL = "claude-haiku-5-5";
const COOKIE = "hk_uid";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

function identidad(req: NextRequest): { who: Identidad; nueva: boolean } {
  const existente = req.cookies.get(COOKIE)?.value;
  const valida = existente && /^[a-f0-9-]{36}$/.test(existente);
  const uid = valida ? existente : crypto.randomUUID();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return { who: { uid, ip }, nueva: !valida };
}

function responder<T>(body: T, status: number, uid: string, nueva: boolean) {
  const res = Response.json(body, { status });
  if (nueva) {
    res.headers.append(
      "Set-Cookie",
      `${COOKIE}=${uid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** GET: today's usage for the counter ("X de 3 gratis hoy"). */
export async function GET(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const uso = publico(await consultarUso("hooks", who));
  return responder({ uso }, 200, who.uid, nueva);
}

export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const fail = (status: number, body: ErrorResponse) => responder(body, status, who.uid, nueva);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, { error: "No pudimos leer la solicitud.", codigo: "validacion" });
  }
  const parsed = GenerarRequest.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return fail(400, { error: msg && !msg.startsWith("Invalid") ? msg : "Revisa los datos e intenta de nuevo.", codigo: "validacion" });
  }
  const body = parsed.data;

  const anthropic = getClient();
  if (!anthropic) {
    return fail(500, {
      error: "Falta configurar ANTHROPIC_API_KEY en las variables de entorno del servidor.",
      codigo: "config",
    });
  }

  const usoHooks = await consultarUso("hooks", who);
  const usoAccion = body.tipo === "hooks" ? usoHooks : await consultarUso("guion", who);
  if (usoAccion.bloqueado) {
    const uso = publico(usoHooks);
    return fail(429, {
      error:
        body.tipo === "hooks"
          ? "Ya usaste tus 3 generaciones gratis de hoy. Vuelve mañana o revisa el plan Pro."
          : "Llegaste al máximo de guiones por hoy. Vuelve mañana.",
      codigo: "limite",
      uso,
    });
  }

  try {
    if (body.tipo === "hooks") {
      const res = await anthropic.messages.parse({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(HooksOutput) },
        messages: [{ role: "user", content: promptHooks(body) }],
      });
      if (res.stop_reason === "refusal" || !res.parsed_output) {
        return fail(422, {
          error: "No pudimos generar hooks con esa idea. Prueba a describirla de otra forma.",
          codigo: "ia",
        });
      }
      const hooks = res.parsed_output.hooks
        .filter((h) => h.texto.trim() && TIPOS_HOOK.includes(h.tipo))
        .slice(0, 10);
      const uso = await registrarUso("hooks", who);
      return responder<HooksResponse>({ hooks, uso }, 200, who.uid, nueva);
    }

    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(GuionOutput) },
      messages: [{ role: "user", content: promptGuion(body) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return fail(422, { error: "No pudimos escribir el guion. Intenta con otro hook.", codigo: "ia" });
    }
    const out = res.parsed_output;
    await registrarUso("guion", who);
    const uso = publico(usoHooks);
    return responder<GuionResponse>(
      {
        guion: {
          ...out.guion,
          duracionSegundos: Math.round(Math.min(60, Math.max(30, out.guion.duracionSegundos || 45))),
        },
        captions: out.captions.slice(0, 5).map((c) => ({
          texto: c.texto,
          hashtags: c.hashtags
            .map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, ""))
            .filter((h) => h.length > 1)
            .slice(0, 6),
        })),
        uso,
      },
      200,
      who.uid,
      nueva,
    );
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return fail(503, { error: "Hay mucha demanda en este momento. Intenta en unos segundos.", codigo: "ia" });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return fail(500, { error: "La API key del servidor no es válida.", codigo: "config" });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error", error.status, error.message);
      return fail(502, { error: "El servicio de IA no respondió bien. Intenta de nuevo.", codigo: "ia" });
    }
    console.error(error);
    return fail(500, { error: "Algo salió mal. Intenta de nuevo.", codigo: "ia" });
  }
}
