"use server";

import { createClient } from "@/lib/server";
import { escapeHtml } from "@/lib/email";

import { type TimeSlot } from "@/lib/visita";

/** Returns the list of already-taken slots for a given date (ISO: YYYY-MM-DD). */
export async function getVisitaSlots(date: string): Promise<TimeSlot[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_visita_taken_slots", { p_date: date });
  return ((data as string[] | null) ?? []) as TimeSlot[];
}

export type VisitaResult =
  | { ok: true; visitaId: string; date: string; timeSlot: string }
  | { error: string };

export async function scheduleVisita(
  date: string,
  timeSlot: string,
): Promise<VisitaResult> {
  if (!date || !timeSlot) return { error: "Selecciona fecha y horario." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!pawwer) return { error: "No encontramos tu perfil de Pawwer." };
  if (pawwer.status !== "visita_pendiente") {
    return { error: "No tienes acceso a este paso en este momento." };
  }

  const { data: visitaId, error: rpcErr } = await supabase.rpc(
    "schedule_visita_domiciliaria",
    { p_date: date, p_time_slot: timeSlot },
  );

  if (rpcErr) {
    console.error("[Pawwi visita]", rpcErr.message);
    if (rpcErr.message.includes("Ya tienes")) {
      return { error: "Ya tienes una visita agendada." };
    }
    return { error: "No se pudo agendar la visita. Intenta de nuevo." };
  }

  // Notificar a Luisa por email
  const adminEmail = process.env.PAWWI_ADMIN_EMAIL;
  const resendKey  = process.env.RESEND_API_KEY;
  const pawwiUrl   = process.env.PAWWI_URL ?? "https://pawwi.co";

  if (adminEmail && resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Pawwi <hola@pawwi.co>",
          to:   adminEmail,
          subject: "Nueva visita domiciliaria agendada",
          html: `
            <p>Un Pawwer ha agendado una visita domiciliaria.</p>
            <ul>
              <li><strong>Pawwer ID:</strong> ${escapeHtml(user.id)}</li>
              <li><strong>Fecha:</strong> ${escapeHtml(date)}</li>
              <li><strong>Horario:</strong> ${escapeHtml(timeSlot)}</li>
            </ul>
            <p><a href="${pawwiUrl}">Ver en Pawwi</a></p>
          `,
        }),
      });
    } catch {
      // graceful — no bloquear al usuario si el email falla
    }
  }

  return { ok: true, visitaId: visitaId as string, date, timeSlot };
}
