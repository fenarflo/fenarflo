import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Maps an Anthropic SDK error to a status and a message people can act on. */
export function errorIA(error: unknown): { status: number; error: string; codigo: "ia" | "config" } {
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 503, error: "Hay mucha demanda en este momento. Intenta en unos segundos.", codigo: "ia" };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 500, error: "La API key de Anthropic del servidor no es válida.", codigo: "config" };
  }
  if (error instanceof Anthropic.APIError && /credit balance|billing/i.test(error.message)) {
    return { status: 500, error: "La cuenta de Anthropic no tiene saldo: carga créditos en console.anthropic.com.", codigo: "config" };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return { status: 500, error: "Anthropic bloqueó la llave: termina la verificación de identidad en console.anthropic.com.", codigo: "config" };
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Anthropic API error", error.status, error.message);
    return { status: 502, error: "El servicio de IA no respondió bien. Intenta de nuevo.", codigo: "ia" };
  }
  console.error(error);
  return { status: 500, error: "Algo salió mal. Intenta de nuevo.", codigo: "ia" };
}
