-- ============================================================
-- 14_visita_domiciliaria.sql
-- Agendamiento de visita domiciliaria (4to filtro)
-- Correr DESPUÉS de 13_capacitacion.sql
-- ============================================================

-- 1. Ampliar constraint de status para incluir 'visita_pendiente'
ALTER TABLE public.pawwer DROP CONSTRAINT IF EXISTS pawwer_status_check;
ALTER TABLE public.pawwer
  ADD CONSTRAINT pawwer_status_check
  CHECK (status IN (
    'pending_review','exam_ready','preselected',
    'needs_review','rejected','visita_pendiente','approved'
  ));

-- 2. Actualizar set_pawwer_capacitacion_result: aprobado → visita_pendiente (no approved)
CREATE OR REPLACE FUNCTION public.set_pawwer_capacitacion_result(
  p_score  integer,
  p_passed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.capacitacion_results (pawwer_id, user_id, score, total, passed)
  VALUES (auth.uid(), auth.uid(), p_score, 27, p_passed);

  IF p_passed THEN
    UPDATE public.pawwer
    SET status = 'visita_pendiente'
    WHERE id = auth.uid()
      AND status = 'preselected';
  END IF;
END;
$$;

-- 3. Tabla visita_domiciliaria
CREATE TABLE IF NOT EXISTS public.visita_domiciliaria (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pawwer_id      UUID NOT NULL REFERENCES public.pawwer(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  time_slot      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','completed','cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.visita_domiciliaria ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'visita_domiciliaria' AND policyname = 'visita_own'
  ) THEN
    EXECUTE 'CREATE POLICY "visita_own" ON public.visita_domiciliaria FOR ALL USING (pawwer_id = auth.uid())';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS visita_pawwer_idx ON public.visita_domiciliaria (pawwer_id);

-- 4. RPC para agendar visita (SECURITY DEFINER para bypassar RLS en la inserción)
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
  v_id   UUID;
BEGIN
  -- Validar que el pawwer está en visita_pendiente
  IF NOT EXISTS (
    SELECT 1 FROM public.pawwer
    WHERE id = auth.uid() AND status = 'visita_pendiente'
  ) THEN
    RAISE EXCEPTION 'Estado inválido para agendar visita';
  END IF;

  -- Solo una visita por pawwer (evitar duplicados)
  IF EXISTS (
    SELECT 1 FROM public.visita_domiciliaria
    WHERE pawwer_id = auth.uid() AND status IN ('pending','confirmed')
  ) THEN
    RAISE EXCEPTION 'Ya tienes una visita agendada';
  END IF;

  -- Validar slot
  IF p_time_slot NOT IN ('9am – 11am', '11am – 1pm', '2pm – 4pm', '4pm – 6pm') THEN
    RAISE EXCEPTION 'Franja horaria inválida';
  END IF;

  INSERT INTO public.visita_domiciliaria (pawwer_id, scheduled_date, time_slot)
  VALUES (auth.uid(), p_date, p_time_slot)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
