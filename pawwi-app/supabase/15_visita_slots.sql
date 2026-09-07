-- ============================================================
-- 15_visita_slots.sql
-- Disponibilidad real de visitas: slots únicos + máx 4/día
-- Correr DESPUÉS de 14_visita_domiciliaria.sql
-- ============================================================

-- 1. Partial unique index: un slot activo por fecha
--    Las visitas canceladas liberan el slot para re-uso.
CREATE UNIQUE INDEX IF NOT EXISTS visita_unique_active_slot
ON public.visita_domiciliaria (scheduled_date, time_slot)
WHERE status IN ('pending', 'confirmed');

-- 2. RPC: devuelve los slots ocupados para una fecha (SECURITY DEFINER — bypassea RLS)
CREATE OR REPLACE FUNCTION public.get_visita_taken_slots(p_date date)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(ARRAY_AGG(time_slot), '{}')
  FROM public.visita_domiciliaria
  WHERE scheduled_date = p_date
    AND status IN ('pending', 'confirmed');
$$;

-- 3. Actualizar schedule_visita_domiciliaria: nuevas horas + validación de disponibilidad
CREATE OR REPLACE FUNCTION public.schedule_visita_domiciliaria(
  p_date      date,
  p_time_slot text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pawwer
    WHERE id = auth.uid() AND status = 'visita_pendiente'
  ) THEN
    RAISE EXCEPTION 'Estado inválido para agendar visita';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.visita_domiciliaria
    WHERE pawwer_id = auth.uid() AND status IN ('pending','confirmed')
  ) THEN
    RAISE EXCEPTION 'Ya tienes una visita agendada';
  END IF;

  IF p_time_slot NOT IN ('9:00am', '11:00am', '2:00pm', '4:00pm') THEN
    RAISE EXCEPTION 'Horario inválido';
  END IF;

  -- Verificar disponibilidad del slot (el índice único también lo captura, pero damos un error claro)
  IF EXISTS (
    SELECT 1 FROM public.visita_domiciliaria
    WHERE scheduled_date = p_date
      AND time_slot = p_time_slot
      AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Este horario ya está ocupado en esa fecha';
  END IF;

  INSERT INTO public.visita_domiciliaria (pawwer_id, scheduled_date, time_slot)
  VALUES (auth.uid(), p_date, p_time_slot)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
