-- ============================================================
-- PAWWI — Resumen de "Próximo pago automático" (pantalla Ganancias)
-- Correr en Supabase SQL Editor después de 46_commission_rate_getters.sql
--
-- Los pagos al pawwer son semanales y AUTOMÁTICOS: cada viernes se deposita lo
-- ganado en la semana viernes→jueves anterior. Como todavía NO existe una tabla
-- de pagos (paid_at), esto es una HEURÍSTICA MVP basada en la fecha de fin del
-- cuidado (end_date) y el estado 4 (completado):
--   • next_payout_date  = próximo viernes ≥ hoy (hoy si es viernes), en Bogotá.
--   • period_start/​end  = ventana viernes→jueves que se paga ese viernes.
--   • next_payout_amount = Σ pawwer_payout de cuidados completados en la ventana.
--   • pending_boundary   = period_start → el front separa "Pagados" (end_date <
--                          boundary, ciclos ya depositados) de "Pendientes".
--   • lifetime_earnings  = Σ pawwer_payout de TODO lo completado.
-- Cuando se integre el motor de pagos real, esto se reemplaza por paid_at.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pawwer_payout_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_today        date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_dow          int  := EXTRACT(DOW FROM v_today)::int;      -- 0=Dom … 5=Vie … 6=Sáb
  v_next_friday  date := v_today + ((5 - v_dow + 7) % 7);     -- próximo viernes ≥ hoy
  v_period_start date := v_next_friday - 7;                   -- viernes de la semana pagada
  v_period_end   date := v_next_friday - 1;                   -- jueves de esa semana
  v_result       jsonb;
BEGIN
  SELECT jsonb_build_object(
    'today',              v_today,
    'next_payout_date',   v_next_friday,
    'period_start',       v_period_start,
    'period_end',         v_period_end,
    'pending_boundary',   v_period_start,
    'next_payout_amount', COALESCE(SUM(pawwer_payout) FILTER (
        WHERE status_id = 4 AND end_date BETWEEN v_period_start AND v_period_end), 0),
    'pending_count',      COALESCE(COUNT(*) FILTER (
        WHERE status_id = 4 AND end_date BETWEEN v_period_start AND v_period_end), 0),
    'lifetime_earnings',  COALESCE(SUM(pawwer_payout) FILTER (WHERE status_id = 4), 0)
  )
  INTO v_result
  FROM public.booking
  WHERE pawwer_id = v_uid;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_payout_summary() TO authenticated;
