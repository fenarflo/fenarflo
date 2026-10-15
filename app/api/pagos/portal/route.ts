import type { NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/server/cuenta";
import { identidad, origen, responder } from "@/lib/server/identidad";
import { getStripe } from "@/lib/server/pagos";

/** POST: Stripe's customer portal (cancel, change card, invoices). */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const stripe = getStripe();
  const c = await obtenerCuenta(who.uid);
  if (!stripe || !c.customer) return responder({ error: "No encontramos pagos en esta cuenta." }, 404, who.uid, nueva);
  try {
    const s = await stripe.billingPortal.sessions.create({ customer: c.customer, return_url: `${origen(req)}/cuenta`, locale: "es-419" });
    return responder({ url: s.url }, 200, who.uid, nueva);
  } catch (e) {
    console.error("Stripe portal", e);
    return responder({ error: "No pudimos abrir tu suscripción. Intenta de nuevo." }, 502, who.uid, nueva);
  }
}
