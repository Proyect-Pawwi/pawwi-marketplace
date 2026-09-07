-- ============================================================
-- PAWWI — A3: Cron en SQL (reemplaza la Edge Function escalate-bookings)
-- Correr en Supabase SQL Editor después de 38_client_cancel.sql
--
-- Porta TODA la lógica del cron a una función SQL y la agenda con pg_cron,
-- así corre cada minuto en la base sin depender del CLI ni de desplegar la
-- Edge Function (que daba 403 por privilegios de la cuenta).
--
-- run_booking_cron() hace, en orden:
--   1. Fase 1 → 2  (vencidas): escala + candidatos + suelta pawwer_id.
--   2. Fase 2 → 3  (vencidas): escala + candidatos (ciudad).
--   3. Fase 3 vencida → sin_cuidador (status 6).
--   4. Avance de estados por tiempo (confirmada→en curso→completada).
--
-- ⚠️ NO agendes también la Edge Function: usa SOLO este cron o solo el edge,
--    nunca los dos (evita doble procesamiento).
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_booking_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        uuid;
  v_escalated int := 0;
  v_expired   int := 0;
BEGIN
  -- ── 1. Fase 1 → 2 (solicitud directa vencida) ──────────────
  FOR v_id IN
    SELECT id FROM public.booking
    WHERE status_id = 1 AND search_phase = 1
      AND phase_expires_at IS NOT NULL AND phase_expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.booking
    SET search_phase = 2, phase_expires_at = now() + INTERVAL '6 hours'
    WHERE id = v_id;

    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT v_id, cand.pawwer_id, 2
    FROM   public.find_escalation_candidates(v_id, 2) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;

    -- soltar al pawwer original (deja de aparecerle / no puede aceptar vencida)
    UPDATE public.booking SET pawwer_id = NULL WHERE id = v_id;
    v_escalated := v_escalated + 1;
  END LOOP;

  -- ── 2. Fase 2 → 3 (búsqueda relacionada vencida → ciudad) ──
  FOR v_id IN
    SELECT id FROM public.booking
    WHERE status_id = 1 AND search_phase = 2
      AND phase_expires_at IS NOT NULL AND phase_expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.booking
    SET search_phase = 3, phase_expires_at = now() + INTERVAL '6 hours'
    WHERE id = v_id;

    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT v_id, cand.pawwer_id, 3
    FROM   public.find_escalation_candidates(v_id, 3) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;
    v_escalated := v_escalated + 1;
  END LOOP;

  -- ── 3. Fase 3 vencida → sin_cuidador (6) ───────────────────
  UPDATE public.booking
  SET    status_id = 6
  WHERE  status_id = 1 AND search_phase = 3
    AND  phase_expires_at IS NOT NULL AND phase_expires_at <= now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- ── 4. Avance de estados por tiempo (global) ───────────────
  PERFORM public.advance_all_booking_statuses();

  RETURN jsonb_build_object('escalated', v_escalated, 'expired', v_expired, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_booking_cron() TO postgres, service_role;

-- ── Habilitar pg_cron y agendar cada minuto ───────────────────
-- Si esta línea falla, habilita pg_cron desde el Dashboard:
--   Database → Extensions → pg_cron (toggle ON), y vuelve a correr desde aquí.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-ejecutable: desagenda el job anterior si existía.
DO $$
BEGIN
  PERFORM cron.unschedule('pawwi-booking-cron');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule('pawwi-booking-cron', '* * * * *', $$SELECT public.run_booking_cron();$$);

-- Verificar que quedó agendado:
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'pawwi-booking-cron';
-- Ver últimas corridas:
--   SELECT status, return_message, start_time FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='pawwi-booking-cron')
--   ORDER BY start_time DESC LIMIT 5;
