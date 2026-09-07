-- ============================================================
-- PAWWI — "Pausar perfil" end-to-end (no cosmético)
-- Correr en Supabase SQL Editor después de 50_home_photos.sql
--
-- Un pawwer con accepting_bookings=false (o deactivated_at no nulo) NO debe
-- recibir reservas. Tres frentes:
--   1) Marketplace (front, app/page.tsx): filtra accepting_bookings + deactivated_at.
--   2) find_escalation_candidates: excluye pausados/desactivados de fases 2/3.
--   3) Trigger: rechaza una reserva DIRECTA (status 1 con pawwer_id) a un pausado.
-- ============================================================

-- ── 1. find_escalation_candidates — excluir pausados ──────────
CREATE OR REPLACE FUNCTION public.find_escalation_candidates(
  p_booking_id uuid,
  p_phase      int   -- 2 o 3
)
RETURNS TABLE(pawwer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_service_type_id int;
  v_original_pawwer uuid;
  v_pawwer_payout   numeric;
  v_start_date      date;
  v_end_date        date;
  v_days            int;
  v_min_rate        numeric;
  v_max_rate        numeric;
BEGIN
  SELECT b.service_type_id, b.pawwer_id, b.pawwer_payout,
         b.start_date, b.end_date
  INTO   v_service_type_id, v_original_pawwer, v_pawwer_payout,
         v_start_date, v_end_date
  FROM   public.booking b
  WHERE  b.id = p_booking_id;

  v_days     := GREATEST(1, v_end_date - v_start_date);
  v_min_rate := (v_pawwer_payout / v_days) * 0.80;
  v_max_rate := (v_pawwer_payout / v_days) * 1.20;

  RETURN QUERY
  SELECT DISTINCT sxp.id_pawwer
  FROM   public."service_X_Pawwer" sxp
  JOIN   public.pawwer pw ON pw.id = sxp.id_pawwer
  WHERE  sxp.id_service = v_service_type_id
    AND  sxp.is_active  = true
    AND  pw.status      = 'approved'
    AND  pw.accepting_bookings = true          -- ← no pausados
    AND  pw.deactivated_at IS NULL             -- ← no desactivados
    AND  sxp.id_pawwer != COALESCE(v_original_pawwer, '00000000-0000-0000-0000-000000000000'::uuid)
    AND  (p_phase = 3 OR sxp.price BETWEEN v_min_rate AND v_max_rate)
    AND  NOT EXISTS (
           SELECT 1
           FROM   (
             SELECT (v_start_date + gs.i)::date AS d
             FROM   generate_series(0, v_end_date - v_start_date) AS gs(i)
           ) dates
           WHERE  NOT EXISTS (
             SELECT 1
             FROM   public.availability a
             WHERE  a.pawwer_id       = sxp.id_pawwer
               AND  a.date            = dates.d
               AND  a.slots_remaining > 0
           )
         )
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.booking_candidates bc
           WHERE  bc.booking_id = p_booking_id
             AND  bc.pawwer_id  = sxp.id_pawwer
         );
END;
$$;

-- ── 2. Trigger: no aceptar reserva directa a un pawwer pausado ─
CREATE OR REPLACE FUNCTION public.guard_direct_booking_paused()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo aplica a la reserva DIRECTA (fase 1: status 1 con pawwer asignado).
  IF NEW.status_id = 1 AND NEW.pawwer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pawwer
      WHERE id = NEW.pawwer_id
        AND accepting_bookings = true
        AND deactivated_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Este cuidador no está recibiendo reservas en este momento';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_direct_booking_paused ON public.booking;
CREATE TRIGGER trg_guard_direct_booking_paused
  BEFORE INSERT ON public.booking
  FOR EACH ROW EXECUTE FUNCTION public.guard_direct_booking_paused();
