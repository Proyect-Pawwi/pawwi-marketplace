"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PawwerStats {
  bookings_completed: number;
  pawwer_earnings: number;
  active_bookings: number;
  pending_bookings: number;
}

// Resumen del "próximo pago automático" (pantalla Ganancias). Fechas en Bogotá.
// Pagado/pendiente sale del ledger real (booking.paid_at), no de una heurística.
export interface PayoutSummary {
  today: string;
  next_payout_date: string;
  next_payout_amount: number;  // Σ completado sin pagar (lo que se te debe)
  pending_count: number;
  paid_total: number;
  lifetime_earnings: number;
}

export interface BookingClient {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface BookingDog {
  name: string;
  breed: string | null;
  photo_url: string | null;
  age?: number | null;
  notes?: string | null;
  weight_kg?: number | null;
  sex?: "macho" | "hembra" | null;
}

export interface BookingRow {
  id: string;
  start_date: string;
  end_date: string;
  total: number;
  pawwer_payout: number;
  commission_rate?: number | null;
  paid_at?: string | null;
  accepted_at?: string | null;
  status_id: number;
  search_phase: 1 | 2 | 3;
  phase_expires_at: string | null;
  created_at: string;
  comments: string | null;
  start_time?: string | null;
  end_time?: string | null;
  client_lat?: number | null;
  client_lng?: number | null;
  client_neighborhood?: string | null;
  client_address?: string | null;
  transport_legs?: number | null;
  transport_fee?: number | null;
  transport_provider?: "pawwer" | "pawwi" | null;
  transport_decided?: boolean | null;
  service_type: string;
  client: BookingClient;
  dogs: BookingDog[];
  review?: { rating: number; comment: string | null } | null;
}

// ── Booking mutations ─────────────────────────────────────────────────────────

export async function acceptBooking(bookingId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_booking", { p_booking_id: bookingId });
  if (error) return { error: "No se pudo aceptar la reserva. Intenta de nuevo." };
  revalidatePath("/pawwer/inicio");
  revalidatePath("/pawwer/cuidados");
  return {};
}

// Declinar una solicitud en cualquier fase.
// Fase 1: restaura slots y escala a fase 2 de inmediato.
// Fases 2/3: elimina la candidatura de este pawwer.
export async function declineSolicitud(bookingId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_solicitud", { p_booking_id: bookingId });
  if (error) {
    console.error("[declineSolicitud]", error.message, error.details, error.hint, error.code);
    return { error: error.message || "No se pudo declinar la solicitud." };
  }
  revalidatePath("/pawwer/inicio");
  revalidatePath("/pawwer/cuidados");
  return {};
}

// El pawwer cancela un cuidado confirmado o en curso.
// Libera el cupo bloqueado al aceptar, avisa al cliente y lo pasa a "Cancelada".
export async function cancelBooking(bookingId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  if (error) {
    console.error("[cancelBooking]", error.message, error.details, error.hint, error.code);
    return { error: error.message || "No se pudo cancelar el cuidado." };
  }
  revalidatePath("/pawwer/cuidados");
  revalidatePath("/pawwer/inicio");
  return {};
}

// El pawwer decide, tras aceptar, si el transporte lo hace él o Pawwi.
// 'pawwer' → recibe 75% del transporte. 'pawwi' → Pawwi se queda con el 100%.
export async function setTransportProvider(
  bookingId: string,
  provider: "pawwer" | "pawwi",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_transport_provider", {
    p_booking_id: bookingId,
    p_provider:   provider,
  });
  if (error) return { error: "No se pudo actualizar el transporte." };
  revalidatePath("/pawwer/cuidados");
  revalidatePath("/pawwer/inicio");
  return {};
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getPawwerStats(start: string, end: string): Promise<PawwerStats> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_pawwer_stats", { p_start: start, p_end: end });
  return (
    (data as PawwerStats) ?? {
      bookings_completed: 0,
      pawwer_earnings: 0,
      active_bookings: 0,
      pending_bookings: 0,
    }
  );
}

// ── Profile mutations ─────────────────────────────────────────────────────────

export async function updatePawwerProfile(
  bio: string,
  experiencia: string,
  neighborhood: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_pawwer_profile", {
    p_bio: bio,
    p_experiencia: experiencia,
    p_neighborhood: neighborhood,
  });
  if (error) return { error: "No se pudo guardar el perfil." };
  revalidatePath("/pawwer/perfil");
  return {};
}

// ── Chart data ────────────────────────────────────────────────────────────────

export interface ChartPoint {
  date: string;
  earnings: number;
  count: number;
}

export async function getEarningsDaily(start: string, end: string): Promise<ChartPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_pawwer_earnings_daily", {
    p_start: start,
    p_end: end,
  });
  return (data as ChartPoint[]) ?? [];
}

export async function updateServicePrice(
  serviceId: number,
  price: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_service_price", {
    p_service_id: serviceId,
    p_price: price,
  });
  if (error) return { error: "No se pudo actualizar el precio." };
  revalidatePath("/pawwer/perfil");
  return {};
}
