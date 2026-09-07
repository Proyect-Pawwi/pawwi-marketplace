-- ============================================================
-- PAWWI — Datos diarios para gráfica del portal Pawwer
-- Correr en Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pawwer_earnings_daily(p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date',     to_char(d.day::date, 'YYYY-MM-DD'),
      'earnings', COALESCE(agg.total_earnings, 0),
      'count',    COALESCE(agg.total_count, 0)
    )
    ORDER BY d.day
  ), '[]'::jsonb)
  INTO v_result
  FROM generate_series(p_start, p_end, '1 day'::interval) AS d(day)
  LEFT JOIN (
    SELECT
      start_date,
      SUM(pawwer_payout)::numeric AS total_earnings,
      COUNT(*)::int               AS total_count
    FROM public.booking
    WHERE pawwer_id = auth.uid()
      AND status_id = 4
      AND start_date BETWEEN p_start AND p_end
    GROUP BY start_date
  ) agg ON agg.start_date = d.day::date;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_earnings_daily(date, date) TO authenticated;
