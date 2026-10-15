import { NextResponse, type NextRequest } from "next/server";
import { cookieUid, origen, uidValido } from "@/lib/server/identidad";
import { aplicarCheckout, getStripe } from "@/lib/server/pagos";

/*
 * Stripe sends people back here after paying. Applying the payment now (and
 * again from the webhook, idempotently) means minutes show up right away even
 * if the webhook is late or not configured yet.
 */
export async function GET(req: NextRequest) {
  const base = origen(req);
  const sid = req.nextUrl.searchParams.get("session_id");
  const stripe = getStripe();
  if (!sid || !stripe) return NextResponse.redirect(`${base}/cuenta`);
  try {
    const s = await stripe.checkout.sessions.retrieve(sid);
    await aplicarCheckout(s);
    const pendiente = s.mode === "payment" && s.payment_status !== "paid";
    const res = NextResponse.redirect(`${base}/cuenta?pago=${pendiente ? "pendiente" : "ok"}`);
    // Paid from another browser (e.g. Stripe opened outside the app): bring the account along.
    const uid = s.metadata?.uid;
    if (uidValido(uid) && req.cookies.get("hk_uid")?.value !== uid) res.headers.append("Set-Cookie", cookieUid(uid));
    return res;
  } catch (e) {
    console.error("Stripe confirmar", e);
    return NextResponse.redirect(`${base}/cuenta?pago=error`);
  }
}
