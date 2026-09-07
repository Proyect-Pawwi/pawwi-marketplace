"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";

// El cliente cancela su reserva antes de que inicie (pendiente o confirmada).
export async function cancelBookingClient(bookingId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking_client", { p_booking_id: bookingId });
  if (error) {
    console.error("[cancelBookingClient]", error.message);
    return { error: error.message || "No se pudo cancelar la reserva." };
  }
  revalidatePath("/mis-reservas");
  revalidatePath(`/booking/confirmada/${bookingId}`);
  return {};
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
