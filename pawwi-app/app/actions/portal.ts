"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { horaBogota, notifyRefundDue, userContact } from "@/lib/cobro";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PawwerStats {
  bookings_completed: number;
  pawwer_earnings: number;
  active_bookings: number;
  pending_bookings: number;
}

// Resumen del próximo pago al Pawwer (pantalla Ganancias). Fechas en Bogotá.
// Pagado/pendiente sale del ledger real (booking.paid_at = cuándo Pawwi le
// transfirió), no de una heurística. Lo que se le debe es `pawwer_earns`.
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
  // Comportamiento (mig 57). null = el dueño aún no lo declaró — ver lib/dog-behavior.ts
  friendly_dogs?: boolean | null;
  separation_anxiety?: boolean | null;
  energy_level?: string | null;
  medical_notes?: string | null;
}

export interface BookingRow {
  id: string;
  start_date: string;
  end_date: string;
  total: number;
  pawwer_payout: number;
  commission_rate?: number | null;
  paid_at?: string | null;          // cuándo Pawwi le TRANSFIRIÓ al Pawwer
  accepted_at?: string | null;
  charged_at?: string | null;       // cuándo pagó el CLIENTE (mig 68)
  payment_due_at?: string | null;   // hasta cuándo puede pagar; NULL = anterior a S2
  late_cancel?: boolean;
  pawwer_earns?: boolean;           // se le debe: completado o cancelación tardía
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
  service_type: string;
  client: BookingClient;
  dogs: BookingDog[];
  review?: { rating: number; comment: string | null } | null;
}

// ── Booking mutations ─────────────────────────────────────────────────────────

// Aceptar ya no confirma: bloquea el cupo y abre al cliente un plazo de 2 horas
// para pagar (mig 68). El cliente tiene que enterarse YA — por eso el correo.
export async function acceptBooking(bookingId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_booking", { p_booking_id: bookingId });
  if (error) return { error: "No se pudo aceptar la reserva. Intenta de nuevo." };
  revalidatePath("/pawwer/inicio");
  revalidatePath("/pawwer/cuidados");

  const aceptada = data as { client_id: string; payment_due_at: string } | null;
  if (aceptada) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: yo } = await supabase.from("profile").select("name").eq("id", user?.id ?? "").maybeSingle();
    const pawwer = (yo?.name as string | undefined) ?? "Tu Pawwer";

    after(async () => {
      const cliente = await userContact(aceptada.client_id);
      if (!cliente?.email) return;
      await sendEmail({
        to: cliente.email,
        subject: `${pawwer} aceptó tu reserva — paga antes de las ${horaBogota(aceptada.payment_due_at)}`,
        html: emailLayout({
          title: `${escapeHtml(pawwer)} aceptó tu reserva 🐾`,
          paragraphs: [
            `Tienes hasta las <strong>${horaBogota(aceptada.payment_due_at)}</strong> para pagar. Hasta que pagues, la reserva <strong>no está confirmada</strong>, y si se vence el plazo, el cupo se libera.`,
            "No se te cobra nada más: el total es el mismo que viste al reservar.",
          ],
          cta: {
            label: "Pagar ahora",
            href: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.pawwi.co"}/booking/confirmada/${bookingId}`,
          },
        }),
      });
    });
  }
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
// Si el cliente ya había pagado, se le devuelve el 100%: la RPC lo anota y aquí
// se avisa al equipo, que es quien hace la transferencia.
export async function cancelBooking(bookingId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  if (error) {
    console.error("[cancelBooking]", error.message, error.details, error.hint, error.code);
    return { error: error.message || "No se pudo cancelar el cuidado." };
  }
  revalidatePath("/pawwer/cuidados");
  revalidatePath("/pawwer/inicio");

  const { data } = await supabase.rpc("get_pawwer_booking_detail", { p_booking_id: bookingId });
  const cancelada = data as { charged_at?: string | null; total?: number } | null;
  if (cancelada?.charged_at) {
    after(() =>
      notifyRefundDue({
        bookingId,
        reason: "El Pawwer canceló un cuidado ya pagado: se le devuelve el 100% al cliente.",
        amount: cancelada.total,
      }),
    );
  }
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
