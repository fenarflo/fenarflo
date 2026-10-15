import type Stripe from "stripe";
import { aplicarCheckout, aplicarFactura, aplicarFinSuscripcion, getStripe } from "@/lib/server/pagos";

/*
 * Stripe → Hookly. In the Stripe dashboard add an endpoint for
 * https://YOUR-SITE/api/pagos/webhook with these events:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   invoice.paid, customer.subscription.updated, customer.subscription.deleted
 * and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Pagos no configurados", { status: 500 });

  const firma = req.headers.get("stripe-signature");
  const cuerpo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(cuerpo, firma ?? "", secret);
  } catch {
    return new Response("Firma inválida", { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await aplicarCheckout(evento.data.object);
        break;
      case "invoice.paid":
        await aplicarFactura(evento.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await aplicarFinSuscripcion(evento.data.object);
        break;
    }
  } catch (e) {
    console.error("Webhook", evento.type, e);
    // Stripe retries on non-2xx, and every handler is idempotent.
    return new Response("Error", { status: 500 });
  }
  return new Response("ok");
}
