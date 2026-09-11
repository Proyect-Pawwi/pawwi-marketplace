"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyRefundDue } from "@/lib/cobro";

export type CancelTerms = {
  can_cancel: boolean;
  charged: boolean;
  hours_left: number;
  refund: number;
  late: boolean;
};

// Lo que pasaría con el dinero si el cliente cancela AHORA. Lo calcula la base
// (get_cancellation_terms) con la misma regla que aplica cancel_booking_client:
// una sola fuente, para que la pantalla no prometa un reembolso que no llega.
export async function getCancelTerms(bookingId: string): Promise<CancelTerms | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cancellation_terms", { p_booking_id: bookingId });
  if (error) return null;
  return data as CancelTerms;
}

// El cliente cancela su reserva antes de que inicie (pendiente o confirmada).
// Política de lo pagado: 100% con 48 h o más de anticipación; con menos, no hay
// reembolso y el Pawwer cobra su parte. El reembolso es manual: se avisa al equipo.
export async function cancelBookingClient(
  bookingId: string,
): Promise<{ error?: string; refund?: number; late?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking_client", { p_booking_id: bookingId });
  if (error) {
    console.error("[cancelBookingClient]", error.message);
    return { error: error.message || "No se pudo cancelar la reserva." };
  }
  revalidatePath("/mis-reservas");
  revalidatePath(`/booking/confirmada/${bookingId}`);

  const res = (data ?? {}) as { refund?: number; late?: boolean };
  if (res.refund && res.refund > 0) {
    after(() =>
      notifyRefundDue({
        bookingId,
        reason: "El cliente canceló una reserva pagada con 48 horas o más de anticipación: se le devuelve el 100%.",
        amount: res.refund,
      }),
    );
  }
  return { refund: res.refund ?? 0, late: res.late ?? false };
}

// El cliente califica a su Pawwer tras un cuidado completado.
export async function createReview(
  bookingId: string,
  rating: number,
  comment: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_review", {
    p_booking_id: bookingId,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) {
    console.error("[createReview]", error.message);
    return { error: "No se pudo enviar tu reseña. Intenta de nuevo." };
  }
  const res = (data ?? {}) as { error?: string };
  if (res.error) return { error: res.error };
  revalidatePath(`/booking/confirmada/${bookingId}`);
  revalidatePath("/mis-reservas");
  return {};
}
