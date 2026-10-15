import "server-only";
import Stripe from "stripe";
import { esPaquete, esPlan } from "@/lib/planes";
import { acreditarPaquete, registrarPago, renovarPlan, terminarPlan, vincularStripe } from "./cuenta";
import { primeraVez } from "./kv";

/*
 * Payments go through Stripe Checkout (hosted page: cards, Apple Pay, Google
 * Pay, and OXXO for one-time packs when enabled in the dashboard). Everything
 * here is idempotent: the webhook and the return page can both apply the same
 * payment and it only counts once.
 */

let stripe: Stripe | null = null;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
  return stripe;
}

const id = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id);

/** A finished Checkout. Packs are credited here; subscriptions through their first invoice. */
export async function aplicarCheckout(s: Stripe.Checkout.Session) {
  const uid = s.metadata?.uid || s.client_reference_id;
  const producto = s.metadata?.producto ?? "";
  if (!uid || s.status !== "complete") return;
  await vincularStripe(uid, { customer: id(s.customer) });

  if (s.mode === "payment") {
    if (s.payment_status !== "paid" || !esPaquete(producto)) return;
    if (!(await primeraVez(`cs:${s.id}`))) return;
    await acreditarPaquete(uid, producto);
    await registrarPago(uid);
    return;
  }

  if (s.mode === "subscription") {
    await vincularStripe(uid, { sub: id(s.subscription) });
    const st = getStripe();
    const invoiceId = id(s.invoice);
    if (st && invoiceId) await aplicarFactura(await st.invoices.retrieve(invoiceId));
  }
}

/** A paid subscription invoice (first one or monthly renewal): refill the plan's minutes. */
export async function aplicarFactura(inv: Stripe.Invoice) {
  if (inv.status !== "paid" || !inv.id) return;
  const det = inv.parent?.subscription_details;
  const uid = det?.metadata?.uid;
  const producto = det?.metadata?.producto ?? "";
  if (!uid || !esPlan(producto)) return;
  if (!(await primeraVez(`in:${inv.id}`))) return;
  const renueva = inv.lines?.data?.[0]?.period?.end;
  await renovarPlan(uid, producto, {
    customer: id(inv.customer),
    sub: id(det?.subscription),
    renueva: renueva ? renueva * 1000 : undefined,
  });
  await registrarPago(uid);
}

export async function aplicarFinSuscripcion(sub: Stripe.Subscription) {
  const uid = sub.metadata?.uid;
  if (!uid) return;
  if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
    await terminarPlan(uid, sub.id);
  }
}
