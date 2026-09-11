"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/server";
import {
  BOLD_CURRENCY,
  boldAmount,
  boldExpiration,
  fetchBoldTransaction,
  integritySignature,
} from "@/lib/bold";
import { notifyPaymentOutcome, recordTransaction } from "@/lib/cobro";
import { SERVICE_LABEL } from "@/lib/services";

/**
 * El pago del cliente. La secuencia completa está en `supabase/68_cobro_bold.sql`:
 * el Pawwer acepta → el cliente tiene 2 horas → paga en el checkout de Bold →
 * el webhook (o la verificación de aquí abajo) sella el pago → confirmada.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.pawwi.co";

/** Lo que necesita `new BoldCheckout(...)`. Todo en texto, como lo pide Bold. */
export type CheckoutConfig = {
  orderId: string;
  currency: string;
  amount: string;
  apiKey: string;
  integritySignature: string;
  redirectionUrl: string;
  description: string;
  expirationDate: string;
};

export type IniciarPagoResult =
  | { estado: "checkout"; config: CheckoutConfig }
  | { estado: "pagado" }
  | { estado: "procesando" }
  | { error: string };

export type VerificarPagoResult = {
  estado: "pagado" | "procesando" | "rechazado" | "sin_pago" | "error";
};

type Intento = { order_id: string; amount: number; status: string; payment_due_at: string };

// Los errores de start_booking_payment están escritos para el cliente. Cualquier
// otro (una caída, un permiso) se queda en el log.
const ERRORES_DE_CLIENTE = [
  "Esta reserva ya está pagada",
  "Esta reserva no está esperando un pago",
  "Se venció el plazo para pagar esta reserva",
  "Reserva no encontrada",
];

export async function iniciarPago(bookingId: string): Promise<IniciarPagoResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const apiKey = process.env.NEXT_PUBLIC_BOLD_API_KEY;
  if (!apiKey || !process.env.BOLD_SECRET_KEY) {
    console.error("[Pawwi pago] Faltan NEXT_PUBLIC_BOLD_API_KEY o BOLD_SECRET_KEY");
    return { error: "Los pagos no están disponibles en este momento. Escríbenos a hola@pawwi.co." };
  }

  let intento = await abrirIntento(supabase, bookingId);
  if ("error" in intento) return intento;

  // Antes de volver a abrir la misma orden, preguntarle a Bold qué pasó con
  // ella. Si ya se pagó, se sella en vez de cobrar otra vez; si se rechazó, se
  // abre una orden nueva (Bold no deja reutilizar una orden con transacciones).
  const tx = await fetchBoldTransaction(intento.order_id);
  if (tx && tx.status !== "NO_TRANSACTION_FOUND") {
    let record;
    try {
      record = await recordTransaction(intento.order_id, tx);
    } catch (err) {
      console.error("[Pawwi pago] iniciar", err);
      return { error: "No pudimos revisar tu pago anterior. Intenta de nuevo en un momento." };
    }
    after(() => notifyPaymentOutcome(record));

    if (tx.status === "APPROVED") {
      refrescar(bookingId);
      return { estado: "pagado" };
    }
    if (tx.status === "PROCESSING" || tx.status === "PENDING") {
      return { estado: "procesando" };
    }
    if (tx.status === "REJECTED" || tx.status === "FAILED") {
      const nuevo = await abrirIntento(supabase, bookingId);
      if ("error" in nuevo) return nuevo;
      intento = nuevo;
    }
  }

  const amount = boldAmount(intento.amount);
  return {
    estado: "checkout",
    config: {
      orderId: intento.order_id,
      currency: BOLD_CURRENCY,
      amount,
      apiKey,
      integritySignature: integritySignature(intento.order_id, amount),
      // Bold vuelve aquí y agrega ?bold-order-id=…&bold-tx-status=…
      redirectionUrl: `${SITE}/booking/confirmada/${bookingId}`,
      description: await descripcion(supabase, bookingId),
      // El checkout se cierra cuando se vence el plazo: después de esa hora el
      // cupo se libera y un pago ya no tendría reserva que confirmar.
      expirationDate: boldExpiration(intento.payment_due_at),
    },
  };
}

/**
 * Pregunta a Bold por el último intento de pago y sella lo que responda. Corre
 * cuando el cliente vuelve del checkout y cuando toca «Ya pagué». En modo de
 * pruebas es la única vía automática: Bold no manda webhooks.
 */
export async function verificarPago(bookingId: string): Promise<VerificarPagoResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { estado: "error" };

  // La RPC comprueba que la reserva sea de este cliente.
  const { data, error } = await supabase.rpc("get_booking_payment_status", { p_booking_id: bookingId });
  if (error) return { estado: "error" };

  const pago = data as { order_id: string; status: string } | null;
  if (!pago) return { estado: "sin_pago" };
  if (pago.status === "aprobado") return { estado: "pagado" };

  const tx = await fetchBoldTransaction(pago.order_id);
  if (!tx || tx.status === "NO_TRANSACTION_FOUND") {
    return { estado: pago.status === "procesando" ? "procesando" : "sin_pago" };
  }

  try {
    const record = await recordTransaction(pago.order_id, tx);
    after(() => notifyPaymentOutcome(record));
  } catch (err) {
    console.error("[Pawwi pago] verificar", err);
    return { estado: "error" };
  }
  refrescar(bookingId);

  switch (tx.status) {
    case "APPROVED":   return { estado: "pagado" };
    case "PROCESSING":
    case "PENDING":    return { estado: "procesando" };
    case "REJECTED":
    case "FAILED":     return { estado: "rechazado" };
    default:           return { estado: "sin_pago" };
  }
}

async function abrirIntento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
): Promise<Intento | { error: string }> {
  const { data, error } = await supabase.rpc("start_booking_payment", { p_booking_id: bookingId });
  if (error) {
    const conocido = ERRORES_DE_CLIENTE.find((m) => error.message.includes(m));
    if (!conocido) console.error("[Pawwi pago] start_booking_payment", error.message);
    return { error: conocido ?? "No se pudo abrir el pago. Intenta de nuevo." };
  }
  return data as Intento;
}

// «Pawwi · Guardería · 14 sep» — lo que el cliente ve en el checkout y en su extracto.
async function descripcion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
): Promise<string> {
  const { data } = await supabase
    .from("booking")
    .select("start_date, service_type!booking_service_type_fkey ( name )")
    .eq("id", bookingId)
    .maybeSingle();

  const b = data as { start_date?: string; service_type?: { name?: string } | null } | null;
  const servicio = b?.service_type?.name ? SERVICE_LABEL[b.service_type.name] ?? b.service_type.name : "Cuidado";
  const fecha = b?.start_date
    ? new Date(`${b.start_date}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" })
    : "";
  return `Pawwi · ${servicio}${fecha ? ` · ${fecha}` : ""}`.slice(0, 100);
}

function refrescar(bookingId: string) {
  revalidatePath(`/booking/confirmada/${bookingId}`);
  revalidatePath("/mis-reservas");
}
