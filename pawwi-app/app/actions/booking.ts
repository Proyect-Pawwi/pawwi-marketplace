"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";

export type BookingResult =
  | { booking_id: string; total: number; commission: number; pawwer_payout: number }
  | { error: string };

export async function crearReserva(formData: FormData): Promise<BookingResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para reservar." };

  const pawwer_id       = formData.get("pawwer_id") as string;
  const start_date      = formData.get("start_date") as string;
  const end_date        = formData.get("end_date") as string;
  const service_type_id = Number(formData.get("service_type_id"));
  const dog_ids         = (formData.get("dog_ids") as string).split(",").filter(Boolean);
  const notes           = (formData.get("notes") as string | null) ?? null;
  const hours_count     = formData.get("hours_count") ? Number(formData.get("hours_count")) : null;
  const transport_legs  = formData.get("transport_legs") ? Number(formData.get("transport_legs")) : 0;

  // Dirección exacta del cuidado (capturada en Step3). Fallback: perfil (en la RPC).
  const address       = (formData.get("address") as string | null)?.trim() || null;
  const client_lat    = formData.get("client_lat") ? Number(formData.get("client_lat")) : null;
  const client_lng    = formData.get("client_lng") ? Number(formData.get("client_lng")) : null;
  const neighborhood  = (formData.get("neighborhood") as string | null)?.trim() || null;
  const start_time    = (formData.get("start_time") as string | null) || null;
  const end_time      = (formData.get("end_time") as string | null) || null;

  if (!pawwer_id || !start_date || !end_date || !service_type_id || dog_ids.length === 0) {
    return { error: "Faltan datos para crear la reserva." };
  }

  const { data, error } = await supabase.rpc("create_booking", {
    p_pawwer_id:       pawwer_id,
    p_start_date:      start_date,
    p_end_date:        end_date,
    p_service_type_id: service_type_id,
    p_dog_ids:         dog_ids,
    p_notes:           notes,
    p_hours_count:     hours_count,
    p_transport_legs:  transport_legs,
    p_address:         address,
    p_lat:             client_lat,
    p_lng:             client_lng,
    p_neighborhood:    neighborhood,
    p_start_time:      start_time,
    p_end_time:        end_time,
  });

  if (error) {
    console.error("[Pawwi] crearReserva RPC:", error.message);
    return { error: "No se pudo crear la reserva. Intenta de nuevo." };
  }

  const result = data as BookingResult;
  if ("error" in result) return result;

  redirect(`/booking/nuevo?step=4&booking_id=${result.booking_id}&total=${result.total}`);
}
