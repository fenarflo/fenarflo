import type { NextRequest } from "next/server";
import { PAQUETES, PLANES, esPaquete, esPlan } from "@/lib/planes";
import { obtenerCuenta } from "@/lib/server/cuenta";
import { identidad, origen, responder } from "@/lib/server/identidad";
import { getStripe } from "@/lib/server/pagos";

/** POST { producto }: creates a Stripe Checkout page and returns its URL. */
export async function POST(req: NextRequest) {
  const { who, nueva } = identidad(req);
  const fail = (status: number, error: string) => responder({ error }, status, who.uid, nueva);
  const stripe = getStripe();
  if (!stripe) return fail(500, "Los pagos aún no están configurados (falta STRIPE_SECRET_KEY).");

  const body = (await req.json().catch(() => null)) as { producto?: string } | null;
  const producto = body?.producto ?? "";
  if (!esPlan(producto) && !esPaquete(producto)) return fail(400, "Producto no válido.");

  const c = await obtenerCuenta(who.uid);
  const base = origen(req);
  const meta = { uid: who.uid, producto };

  try {
    // Already subscribed: changing or cancelling the plan happens in Stripe's portal.
    if (esPlan(producto) && c.sub && c.plan !== "gratis" && c.customer) {
      const portal = await stripe.billingPortal.sessions.create({ customer: c.customer, return_url: `${base}/cuenta`, locale: "es-419" });
      return responder({ url: portal.url }, 200, who.uid, nueva);
    }

    const plan = esPlan(producto) ? PLANES[producto] : null;
    const paquete = esPaquete(producto) ? PAQUETES[producto] : null;
    const session = await stripe.checkout.sessions.create({
      mode: plan ? "subscription" : "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: plan ? plan.precioCentavos : paquete!.precioCentavos,
            product_data: plan
              ? { name: `Hookly ${plan.nombre}`, description: `${plan.minutosMes / 60} horas de video al mes` }
              : { name: `Hookly: ${paquete!.nombre}`, description: `${paquete!.minutos} minutos de video que no caducan` },
            ...(plan ? { recurring: { interval: "month" as const } } : {}),
          },
        },
      ],
      client_reference_id: who.uid,
      metadata: meta,
      ...(plan
        ? { subscription_data: { metadata: meta } }
        : { payment_intent_data: { metadata: meta }, ...(c.customer ? {} : { customer_creation: "always" as const }) }),
      ...(c.customer ? { customer: c.customer } : {}),
      allow_promotion_codes: true,
      locale: "es-419",
      success_url: `${base}/api/pagos/confirmar?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cuenta?pago=cancelado`,
    });
    if (!session.url) return fail(502, "Stripe no devolvió la página de pago.");
    return responder({ url: session.url }, 200, who.uid, nueva);
  } catch (e) {
    console.error("Stripe checkout", e);
    return fail(502, "No pudimos abrir la página de pago. Intenta de nuevo.");
  }
}
