import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Bold, la pasarela. **Solo servidor**: firma con `BOLD_SECRET_KEY`, que no
 * puede llegar nunca al navegador. (Next solo expone las `NEXT_PUBLIC_*`, así
 * que importar esto desde un componente cliente no filtraría la llave — pero
 * tampoco funcionaría.)
 *
 * Qué se usa de Bold y por qué:
 * - **Botón de pagos personalizado** (`BoldCheckout`): el checkout lo pinta
 *   Bold; Pawwi nunca toca datos de tarjeta. Se abre en cualquier momento con
 *   una firma que calcula el servidor — por eso el cobro puede esperar a que el
 *   Pawwer acepte.
 * - **Webhook**: la confirmación de verdad. Bold reintenta hasta 5 veces.
 * - **API de consulta**: la verificación al volver del checkout. En modo de
 *   pruebas Bold **no manda webhooks**, así que ahí es la única vía automática.
 *
 * Lo que Bold NO tiene: API de reembolsos. Solo anula tarjetas de crédito el
 * mismo día antes de las 9 p. m., desde su panel. Todo lo demás es una
 * transferencia manual — ver `supabase/68_cobro_bold.sql`.
 */

export const BOLD_CURRENCY = "COP";

/** Estados de una transacción, en la API de consulta y en el webhook. */
export const BOLD_STATUSES = [
  "APPROVED",
  "REJECTED",
  "FAILED",
  "VOIDED",
  "PROCESSING",
  "PENDING",
  "NO_TRANSACTION_FOUND",
] as const;
export type BoldStatus = (typeof BOLD_STATUSES)[number];

export type BoldTransaction = {
  status: BoldStatus;
  paymentId: string | null;
  amount: number | null;
  method: string | null;
  raw: unknown;
};

/** El monto como lo firma Bold: pesos enteros, sin decimales ni separadores. */
export function boldAmount(total: number): string {
  return String(Math.round(total));
}

/**
 * Firma de integridad: SHA-256 de `{orden}{monto}{divisa}{llave secreta}`.
 * Se calcula SIEMPRE en el servidor: si la calculara el navegador, cualquiera
 * podría cambiar el monto y firmarlo.
 */
export function integritySignature(orderId: string, amount: string): string {
  const secret = process.env.BOLD_SECRET_KEY;
  if (!secret) {
    throw new Error("[Pawwi] Falta BOLD_SECRET_KEY: sin ella no se puede firmar el cobro.");
  }
  return createHash("sha256")
    .update(`${orderId}${amount}${BOLD_CURRENCY}${secret}`)
    .digest("hex");
}

/** Bold pide la expiración del checkout en NANOsegundos desde la época Unix. */
export function boldExpiration(iso: string): string {
  return (BigInt(Date.parse(iso)) * BigInt(1_000_000)).toString();
}

/**
 * Valida el header `x-bold-signature`: HMAC-SHA256 del cuerpo CRUDO codificado
 * en Base64, con la llave secreta, en hexadecimal.
 *
 * En modo de pruebas Bold firma con una llave **vacía**, y una firma con llave
 * vacía la puede fabricar cualquiera. Por eso esa puerta está **cerrada por
 * defecto en todas partes** y solo se abre con `BOLD_ALLOW_TEST_WEBHOOK=1`,
 * nunca en producción.
 *
 * No basta con cerrarla «fuera de producción», que fue el primer intento: los
 * previews de Vercel son públicos y hablan con la MISMA base que producción, y
 * el identificador de orden se deriva del id de la reserva —que el cliente ve
 * en su propia URL—. Con un preview vivo, el cliente podría firmarse un pago
 * aprobado y confirmar su reserva sin pagar.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const encoded = Buffer.from(rawBody, "utf8").toString("base64");
  const keys: string[] = [];
  if (process.env.BOLD_SECRET_KEY) keys.push(process.env.BOLD_SECRET_KEY);
  if (process.env.BOLD_ALLOW_TEST_WEBHOOK === "1" && process.env.VERCEL_ENV !== "production") {
    keys.push("");
  }

  return keys.some((key) =>
    safeEqual(createHmac("sha256", key).update(encoded).digest("hex"), signature),
  );
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Consulta en Bold el estado de una orden. Devuelve `null` si Bold no responde
 * o responde algo que no se entiende — quien llama decide qué hacer, y lo
 * seguro es no dar nada por pagado.
 *
 * Solo sirve para órdenes del botón de pagos (no para links de pago), y una
 * transacción puede tardar unos minutos en aparecer: mientras tanto responde
 * `NO_TRANSACTION_FOUND`.
 */
export async function fetchBoldTransaction(orderId: string): Promise<BoldTransaction | null> {
  const apiKey = process.env.NEXT_PUBLIC_BOLD_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://payments.api.bold.co/v2/payment-voucher/${encodeURIComponent(orderId)}`,
      {
        headers: { Authorization: `x-api-key ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );

    if (res.status === 404) {
      return { status: "NO_TRANSACTION_FOUND", paymentId: null, amount: null, method: null, raw: null };
    }
    if (!res.ok) {
      console.error("[Pawwi Bold] consulta", orderId, res.status);
      return null;
    }

    const json = (await res.json()) as Record<string, unknown>;
    const status = String(json.payment_status ?? "").toUpperCase();
    if (!(BOLD_STATUSES as readonly string[]).includes(status)) {
      console.error("[Pawwi Bold] estado desconocido en la consulta:", status);
      return null;
    }

    return {
      status: status as BoldStatus,
      paymentId: typeof json.payment_id === "string" ? json.payment_id : null,
      amount: toNumber(json.total ?? (json.amount as Record<string, unknown> | undefined)?.total),
      method: typeof json.payment_method === "string" ? json.payment_method : null,
      raw: json,
    };
  } catch (err) {
    console.error("[Pawwi Bold] consulta", orderId, err);
    return null;
  }
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
