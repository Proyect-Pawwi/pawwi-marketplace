-- ============================================================
-- PAWWI — Solicitudes vencidas: escalar y soltar al pawwer
-- Correr en Supabase SQL Editor después de 33_booking_lifecycle.sql
--
-- Problema: cuando a una solicitud fase-1 se le vence el timer, seguía
-- apareciéndole al pawwer (get_pawwer_bookings filtra por pawwer_id = él, y la
-- escalación no soltaba ese pawwer_id). Peor: podía aceptarla ya vencida.
--
-- Fix: advance_booking_statuses ahora, además de avanzar estados por tiempo,
-- ESCALA las solicitudes fase-1 vencidas del pawwer actual (igual que un
-- decline automático): pasa a fase 2, inserta candidatos y suelta el pawwer_id.
-- Así salen de su vista al instante y quedan disponibles para otros pawwers.
-- (Se ejecuta al abrir Home/Cuidados; no depende del cron.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.advance_booking_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- 0) Solicitudes fase-1 MÍAS vencidas → escalar a fase 2 y soltarme.
  --    Mismo comportamiento que decline_solicitud (fase 1), disparado por el
  --    vencimiento del timer en vez de por una acción del pawwer.
  FOR v_id IN
    SELECT id FROM public.booking
    WHERE  pawwer_id = v_uid
      AND  status_id = 1
      AND  search_phase = 1
      AND  phase_expires_at IS NOT NULL
      AND  phase_expires_at <= now()
    FOR UPDATE
  LOOP
    UPDATE public.booking
    SET    search_phase     = 2,
           phase_expires_at = now() + INTERVAL '6 hours'
    WHERE  id = v_id;

    -- find_escalation_candidates aún ve el pawwer_id original → lo excluye.
    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT v_id, cand.pawwer_id, 2
    FROM   public.find_escalation_candidates(v_id, 2) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;

    -- Soltar al pawwer original: deja de aparecerle y no puede aceptarla.
    UPDATE public.booking SET pawwer_id = NULL WHERE id = v_id;
  END LOOP;

  -- 1) confirmada (2) → en curso (3): ya llegó el inicio.
  UPDATE public.booking
  SET    status_id = 3
  WHERE  pawwer_id = v_uid
    AND  status_id = 2
    AND  ((start_date + COALESCE(start_time, TIME '00:00'))
            AT TIME ZONE 'America/Bogota') <= now();

  -- 2) en curso (3) → completada (4): ya pasó el fin.
  UPDATE public.booking
  SET    status_id = 4
  WHERE  pawwer_id = v_uid
    AND  status_id = 3
    AND  ((end_date + COALESCE(end_time, TIME '23:59'))
            AT TIME ZONE 'America/Bogota') <= now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_booking_statuses() TO authenticated;
