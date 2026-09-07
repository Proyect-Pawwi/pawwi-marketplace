/**
 * escalate-bookings — Edge Function con cron cada minuto
 *
 * ⚠️ REEMPLAZADA por el cron en SQL (supabase/39_cron_sql.sql → run_booking_cron
 *    agendada con pg_cron). Usa SOLO una: el cron SQL O esta función, nunca las
 *    dos a la vez (doble procesamiento). Se conserva como referencia/fallback.
 *
 * Maneja las transiciones de fase del sistema de escalación:
 *   Fase 1 (1 h)  → Fase 2 precio similar (6 h) → Fase 3 toda la ciudad (6 h) → sin_cuidador
 *
 * Desplegar: supabase functions deploy escalate-bookings
 * Programar: Supabase Dashboard > Edge Functions > escalate-bookings > Schedule: "* * * * *"
 * Variables de entorno necesarias (ya disponibles en Edge Functions de Supabase):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Opcional para notificaciones:
 *   RESEND_API_KEY (pendiente de configurar)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PHASE_2_MS = 6 * 60 * 60 * 1000; // 6 horas
const PHASE_3_MS = 6 * 60 * 60 * 1000; // 6 horas

interface ExpiredBooking {
  id: string;
  client_id: string;
  search_phase: number;
}

interface CandidateRow {
  pawwer_id: string;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const errors: string[] = [];
  let escalated = 0;
  let expired = 0;

  // ── A3 — Avance de estados por tiempo (global) ─────────────
  // confirmada→en curso→completada. Antes solo pasaba si el pawwer entraba
  // a la app; ahora el cron lo hace para todos (ingresos + estados del cliente).
  {
    const { error } = await supabase.rpc("advance_all_booking_statuses");
    if (error) errors.push(`advance statuses: ${error.message}`);
  }

  // ── Fase 1 → 2 ─────────────────────────────────────────────
  {
    const { data, error } = await supabase
      .from("booking")
      .select("id, client_id, search_phase")
      .eq("status_id", 1)
      .eq("search_phase", 1)
      .lt("phase_expires_at", now);

    if (error) errors.push(`fetch phase1: ${error.message}`);

    for (const b of (data as ExpiredBooking[]) ?? []) {
      const { error: upErr, count } = await supabase
        .from("booking")
        .update({
          search_phase: 2,
          phase_expires_at: new Date(Date.now() + PHASE_2_MS).toISOString(),
        })
        .eq("id", b.id)
        .eq("status_id", 1)
        .eq("search_phase", 1); // guard: evita doble proceso

      if (upErr || count === 0) {
        errors.push(`update phase1→2 ${b.id}: ${upErr?.message ?? "race condition"}`);
        continue;
      }

      const { data: cands, error: candErr } = await supabase
        .rpc("find_escalation_candidates", { p_booking_id: b.id, p_phase: 2 });

      if (candErr) {
        errors.push(`candidates phase2 ${b.id}: ${candErr.message}`);
        continue;
      }

      const candidates = (cands as CandidateRow[]) ?? [];

      if (candidates.length > 0) {
        await supabase.from("booking_candidates").upsert(
          candidates.map(({ pawwer_id }) => ({
            booking_id: b.id,
            pawwer_id,
            phase: 2,
          })),
          { onConflict: "booking_id,pawwer_id", ignoreDuplicates: true },
        );
      }

      // Soltar al pawwer original: deja de aparecerle en el home y no puede
      // aceptar una solicitud ya vencida. (Se nulea DESPUÉS de calcular
      // candidatos, para que find_escalation_candidates aún lo excluya.)
      await supabase.from("booking").update({ pawwer_id: null }).eq("id", b.id);

      // TODO: notificar al cliente (Resend pendiente de configurar)
      // await sendClientNotification(b.client_id, "phase2");

      // TODO: notificar a los candidatos (Resend + push pendiente)
      // await notifyCandidates(candidates.map(c => c.pawwer_id), b.id);

      console.log(`[escalation] ${b.id} → fase 2 | ${candidates.length} candidatos`);
      escalated++;
    }
  }

  // ── Fase 2 → 3 ─────────────────────────────────────────────
  {
    const { data, error } = await supabase
      .from("booking")
      .select("id, client_id, search_phase")
      .eq("status_id", 1)
      .eq("search_phase", 2)
      .lt("phase_expires_at", now);

    if (error) errors.push(`fetch phase2: ${error.message}`);

    for (const b of (data as ExpiredBooking[]) ?? []) {
      const { error: upErr, count } = await supabase
        .from("booking")
        .update({
          search_phase: 3,
          phase_expires_at: new Date(Date.now() + PHASE_3_MS).toISOString(),
        })
        .eq("id", b.id)
        .eq("status_id", 1)
        .eq("search_phase", 2);

      if (upErr || count === 0) {
        errors.push(`update phase2→3 ${b.id}: ${upErr?.message ?? "race condition"}`);
        continue;
      }

      const { data: cands, error: candErr } = await supabase
        .rpc("find_escalation_candidates", { p_booking_id: b.id, p_phase: 3 });

      if (candErr) {
        errors.push(`candidates phase3 ${b.id}: ${candErr.message}`);
        continue;
      }

      const candidates = (cands as CandidateRow[]) ?? [];

      if (candidates.length > 0) {
        await supabase.from("booking_candidates").upsert(
          candidates.map(({ pawwer_id }) => ({
            booking_id: b.id,
            pawwer_id,
            phase: 3,
          })),
          { onConflict: "booking_id,pawwer_id", ignoreDuplicates: true },
        );
      }

      // TODO: notificar al cliente que se amplió a toda la ciudad
      // TODO: notificar a todos los candidatos nuevos

      console.log(`[escalation] ${b.id} → fase 3 | ${candidates.length} candidatos`);
      escalated++;
    }
  }

  // ── Fase 3 expirada → sin_cuidador ─────────────────────────
  {
    const { data, error } = await supabase
      .from("booking")
      .select("id, client_id")
      .eq("status_id", 1)
      .eq("search_phase", 3)
      .lt("phase_expires_at", now);

    if (error) errors.push(`fetch phase3: ${error.message}`);

    for (const b of (data as ExpiredBooking[]) ?? []) {
      const { error: upErr } = await supabase
        .from("booking")
        .update({ status_id: 6 })
        .eq("id", b.id)
        .eq("status_id", 1)
        .eq("search_phase", 3);

      if (upErr) {
        errors.push(`update sin_cuidador ${b.id}: ${upErr.message}`);
        continue;
      }

      // TODO: notificar al cliente que no se encontró cuidador (Resend pendiente)
      // await sendClientNotification(b.client_id, "no_caregiver_found");

      console.log(`[escalation] ${b.id} → sin_cuidador`);
      expired++;
    }
  }

  const body = { escalated, expired, errors };

  if (errors.length > 0) {
    console.error("[escalation] errores:", errors);
    return new Response(JSON.stringify(body), {
      status: 207,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
