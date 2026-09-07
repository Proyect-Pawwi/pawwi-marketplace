-- ============================================================
-- PAWWI — A3 (avance global de estados) + A9 (stats de pendientes)
-- Correr en Supabase SQL Editor después de 34_expire_solicitudes.sql
--
-- A3: advance_all_booking_statuses — versión GLOBAL (no scopeada a auth.uid())
--     para que el cron avance TODOS los cuidados por tiempo aunque el pawwer
--     no entre a la app. Resuelve: ingresos no contabilizados y estados stale
--     en la vista del cliente. (El avance por-pawwer sigue existiendo para dar
--     inmediatez al abrir Home/Cuidados.)
-- A9: get_pawwer_stats — "pendientes" ahora incluye candidaturas fase 2/3.
-- ============================================================

-- ── A3 — avance global de estados por tiempo ──────────────────
CREATE OR REPLACE FUNCTION public.advance_all_booking_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- confirmada (2) → en curso (3): ya llegó el inicio.
  UPDATE public.booking
  SET    status_id = 3
  WHERE  status_id = 2
    AND  ((start_date + COALESCE(start_time, TIME '00:00'))
            AT TIME ZONE 'America/Bogota') <= now();

  -- en curso (3) → completada (4): ya pasó el fin.
  UPDATE public.booking
  SET    status_id = 4
  WHERE  status_id = 3
    AND  ((end_date + COALESCE(end_time, TIME '23:59'))
            AT TIME ZONE 'America/Bogota') <= now();
END;
$$;

-- La llama el cron (service_role). authenticated no la necesita (usa la scopeada).
GRANT EXECUTE ON FUNCTION public.advance_all_booking_statuses() TO service_role;

-- ── A9 — get_pawwer_stats: pendientes incluye candidaturas ─────
CREATE OR REPLACE FUNCTION public.get_pawwer_stats(p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_uid    uuid := auth.uid();
BEGIN
  SELECT jsonb_build_object(
    'bookings_completed', COUNT(*)    FILTER (WHERE status_id = 4 AND start_date BETWEEN p_start AND p_end),
    'pawwer_earnings',    COALESCE(SUM(pawwer_payout) FILTER (WHERE status_id = 4 AND start_date BETWEEN p_start AND p_end), 0),
    'active_bookings',    COUNT(*)    FILTER (WHERE status_id = 3),
    'pending_bookings', (
      -- Directas (fase 1) + candidaturas notificadas (fase 2/3)
      SELECT COUNT(*) FROM public.booking b2
      WHERE b2.status_id = 1
        AND (b2.pawwer_id = v_uid
             OR EXISTS (SELECT 1 FROM public.booking_candidates bc
                        WHERE bc.booking_id = b2.id AND bc.pawwer_id = v_uid))
    )
  )
  INTO v_result
  FROM public.booking
  WHERE pawwer_id = v_uid;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_stats(date, date) TO authenticated;
