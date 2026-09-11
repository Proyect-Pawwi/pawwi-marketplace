import { after } from "next/server";
import { z } from "zod";
import { verifyWebhookSignature, type BoldStatus } from "@/lib/bold";
import { notifyPaymentOutcome, recordTransaction } from "@/lib/cobro";

/**
 * Webhook de Bold — la confirmación de verdad de un pago.
 *
 * Se registra en el panel de Bold (Integraciones → Webhooks) apuntando a
 * https://app.pawwi.co/api/bold/webhook. Bold exige un 200 en menos de dos
 * segundos; si no lo recibe, reintenta a los 15 min, 1 h, 4 h, 8 h y 24 h.
 * Por eso aquí solo se valida y se sella: los correos van en `after()`.
 *
 * En modo de pruebas Bold NO manda webhooks solo — hay que dispararlo con
 * «Probar el webhook» en el comprobante—, y los firma con una llave vacía.
 */

const Evento = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    payment_id: z.string(),
    payment_method: z.string().nullish(),
    amount: z.object({ total: z.number().nullish() }).nullish(),
    // Aquí vuelve el orderId que le mandamos al abrir el checkout
    metadata: z.object({ reference: z.string().nullish() }).nullish(),
  }),
});

// VOID_REJECTED no mueve nada: una anulación que Bold no aprobó.
const ESTADO: Record<string, BoldStatus | undefined> = {
  SALE_APPROVED: "APPROVED",
  SALE_REJECTED: "REJECTED",
  VOID_APPROVED: "VOIDED",
};

export async function POST(request: Request) {
  const raw = await request.text();

  if (!verifyWebhookSignature(raw, request.headers.get("x-bold-signature"))) {
    console.error("[Pawwi webhook Bold] firma inválida");
    return new Response("Firma inválida", { status: 401 });
  }

  let json: unknown;
  let evento: z.infer<typeof Evento>;
  try {
    json = JSON.parse(raw);
    evento = Evento.parse(json);
  } catch {
    return new Response("Payload inválido", { status: 400 });
  }

  const status = ESTADO[evento.type];
  const orderId = evento.data.metadata?.reference;
  if (!status || !orderId) {
    return Response.json({ ok: true, ignorado: evento.type });
  }

  let record;
  try {
    record = await recordTransaction(orderId, {
      status,
      paymentId: evento.data.payment_id,
      amount: evento.data.amount?.total ?? null,
      method: evento.data.payment_method ?? null,
      raw: json,
    });
  } catch (err) {
    // Un 500 hace que Bold reintente. Sellar es idempotente, así que reintentar
    // nunca confirma ni reembolsa dos veces.
    console.error("[Pawwi webhook Bold]", err);
    return new Response("Error", { status: 500 });
  }

  after(() => notifyPaymentOutcome(record));
  return Response.json({ ok: true });
}
