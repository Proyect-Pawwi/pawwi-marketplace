import { adminClient } from "@/lib/admin";
import { type BoldTransaction } from "@/lib/bold";
import { ADMIN_EMAIL, emailLayout, escapeHtml, sendEmail } from "@/lib/email";

/**
 * El cobro, del lado del servidor. Lo comparten el webhook de Bold y la
 * verificación que corre cuando el cliente vuelve del checkout — las dos rutas
 * por las que un pago puede llegar, y que pueden llegar en cualquier orden.
 *
 * Solo servidor: usa `service_role` para sellar el pago. El estado que se
 * sella viene SIEMPRE de Bold (webhook firmado o consulta servidor a
 * servidor), nunca de lo que diga el navegador.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.pawwi.co";

export type PaymentRecord = {
  result:
    | "aprobado"
    | "rechazado"
    | "fallido"
    | "procesando"
    | "anulado"
    | "ya_registrado"
    | "orden_desconocida";
  outcome?: "confirmo" | "duplicado" | "tardio" | "monto_distinto" | null;
  booking_id?: string;
  client_id?: string;
  pawwer_id?: string;
};

/**
 * Sella en la base lo que Bold reportó de una orden. Idempotente: la RPC
 * ignora lo que ya estaba registrado, así que el webhook y la verificación
 * pueden llegar los dos, en cualquier orden y repetidos.
 *
 * `NO_TRANSACTION_FOUND` no se sella: significa que todavía no hay nada.
 */
export async function recordTransaction(
  orderId: string,
  tx: BoldTransaction,
): Promise<PaymentRecord | null> {
  if (tx.status === "NO_TRANSACTION_FOUND") return null;

  const { data, error } = await adminClient().rpc("record_booking_payment", {
    p_order_id:        orderId,
    p_bold_status:     tx.status,
    p_bold_payment_id: tx.paymentId,
    p_amount:          tx.amount,
    p_method:          tx.method,
    p_raw:             tx.raw ?? null,
  });

  if (error) throw new Error(`record_booking_payment: ${error.message}`);
  return data as PaymentRecord;
}

/**
 * Los correos que siguen a un pago. Va dentro de `after()`: nunca retrasa la
 * respuesta a Bold, que exige un 200 en menos de dos segundos, ni al cliente.
 * `sendEmail` no lanza, y sin RESEND_API_KEY no manda nada.
 */
export async function notifyPaymentOutcome(record: PaymentRecord | null) {
  if (!record || record.result !== "aprobado" || !record.booking_id) return;

  if (record.outcome === "confirmo") {
    const [client, pawwer] = await Promise.all([
      userContact(record.client_id),
      userContact(record.pawwer_id),
    ]);

    if (client?.email) {
      await sendEmail({
        to: client.email,
        subject: "Tu reserva está confirmada 🐾",
        html: emailLayout({
          title: `¡Listo${client.name ? `, ${escapeHtml(client.name)}` : ""}!`,
          paragraphs: [
            "Recibimos tu pago y tu reserva quedó <strong>confirmada</strong>. Tu Pawwer ya sabe que el cuidado es firme.",
          ],
          cta: { label: "Ver mi reserva", href: `${SITE}/booking/confirmada/${record.booking_id}` },
        }),
      });
    }
    if (pawwer?.email) {
      await sendEmail({
        to: pawwer.email,
        subject: "El cliente pagó: tu cuidado es firme",
        html: emailLayout({
          title: "Cuidado confirmado",
          paragraphs: [
            "El cliente pagó la reserva que aceptaste. Ya puedes ver su dirección y escribirle en el chat de la reserva.",
          ],
          cta: { label: "Ver el cuidado", href: `${SITE}/pawwer/cuidados/${record.booking_id}` },
        }),
      });
    }
    return;
  }

  // Aprobado pero sin confirmar nada: hay que devolver ese dinero a mano.
  await notifyRefundDue({
    bookingId: record.booking_id,
    reason:
      record.outcome === "duplicado"      ? "Pago duplicado: la reserva ya estaba pagada con otra orden." :
      record.outcome === "tardio"         ? "Pago tardío: la reserva ya había vencido o se había cancelado." :
      record.outcome === "monto_distinto" ? "El monto aprobado no coincide con el de la reserva. No se confirmó nada: revisar." :
                                            "Pago aprobado sin confirmar la reserva.",
  });
}

/**
 * Aviso al equipo de un reembolso por hacer. Hasta que S3 construya la cola en
 * /admin, este correo ES la cola.
 */
export async function notifyRefundDue(opts: { bookingId: string; reason: string; amount?: number }) {
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Reembolso pendiente · reserva ${opts.bookingId.slice(0, 8)}`,
    html: emailLayout({
      title: "Hay un reembolso por hacer",
      paragraphs: [
        escapeHtml(opts.reason),
        opts.amount != null
          ? `Monto: <strong>$${Math.round(opts.amount).toLocaleString("es-CO")}</strong>.`
          : "El monto está en <code>booking_payment.refund_amount</code>.",
        `Reserva: <code>${escapeHtml(opts.bookingId)}</code>.`,
        "Si fue con tarjeta de crédito y es el mismo día antes de las 9 p. m., anúlalo desde el panel de Bold: el webhook lo marca solo. Si no, transfiere al cliente y marca <code>refunded_at</code> en <code>booking_payment</code>.",
      ],
    }),
  });
}

/** Correo y nombre de un usuario, por la Admin API (los correos viven en auth.users). */
export async function userContact(userId?: string | null): Promise<{ email: string | null; name: string | null } | null> {
  if (!userId) return null;
  const { data, error } = await adminClient().auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  return {
    email: data.user.email ?? null,
    name: typeof meta?.name === "string" ? meta.name : null,
  };
}

/** «3:30 p. m.» en hora de Bogotá. */
export function horaBogota(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}
