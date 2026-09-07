-- ============================================================
-- PAWWI — Ciclo de vida del cuidado (transiciones por tiempo)
-- Correr en Supabase SQL Editor después de 32_ops_solicitudes.sql
--
-- Faltaban las transiciones automáticas:
--   confirmada (2) → en curso (3)  cuando llega el inicio del cuidado.
--   en curso   (3) → completada (4) cuando pasa el fin del cuidado.
-- Sin esto, las pestañas "En curso" y "Completadas" quedaban vacías.
--
-- Zona horaria: los cuidados ocurren en hora de Bogotá (America/Bogota).
-- Si no hay hora (start_time/end_time NULL) se asume día completo:
--   inicio = 00:00, fin = 23:59 de la fecha respectiva.
-- ============================================================

-- ── advance_booking_statuses — avanza los cuidados del pawwer actual ──
-- SECURITY DEFINER + auth.uid(): cada pawwer avanza SOLO sus cuidados.
-- Idempotente y barato (índices por status_id). Se llama al cargar Home y
-- Cuidados; un cron opcional puede hacer el barrido global para las stats.
CREATE OR REPLACE FUNCTION public.advance_booking_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- confirmada (2) → en curso (3): ya llegó el inicio.
  UPDATE public.booking
  SET    status_id = 3
  WHERE  pawwer_id = v_uid
    AND  status_id = 2
    AND  ((start_date + COALESCE(start_time, TIME '00:00'))
            AT TIME ZONE 'America/Bogota') <= now();

  -- en curso (3) → completada (4): ya pasó el fin.
  -- (Un cuidado cuyo rango completo ya pasó habrá pasado por 2→3 arriba y
  --  ahora cae aquí 3→4 en la misma llamada.)
  UPDATE public.booking
  SET    status_id = 4
  WHERE  pawwer_id = v_uid
    AND  status_id = 3
    AND  ((end_date + COALESCE(end_time, TIME '23:59'))
            AT TIME ZONE 'America/Bogota') <= now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_booking_statuses() TO authenticated;
