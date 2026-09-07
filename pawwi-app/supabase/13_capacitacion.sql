-- ============================================================
-- 13_capacitacion.sql
-- Resultados de la capacitación Pawwi Academy
-- Correr DESPUÉS de 12_exam_status_rpc.sql
-- ============================================================

-- 1. Tabla de resultados (sin UNIQUE — permite reintentos si reprueba)
CREATE TABLE IF NOT EXISTS public.capacitacion_results (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pawwer_id UUID NOT NULL REFERENCES public.pawwer(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id),
  score     INTEGER NOT NULL,
  total     INTEGER NOT NULL DEFAULT 30,
  passed    BOOLEAN NOT NULL,
  taken_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.capacitacion_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capacitacion_results' AND policyname = 'cap_own'
  ) THEN
    EXECUTE 'CREATE POLICY "cap_own" ON public.capacitacion_results FOR ALL USING (user_id = auth.uid())';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cap_results_pawwer_idx ON public.capacitacion_results (pawwer_id);

-- 2. RPC con SECURITY DEFINER (bypasea RLS — mismo patrón que set_pawwer_exam_result)
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
  -- Guardar intento
  INSERT INTO public.capacitacion_results (pawwer_id, user_id, score, total, passed)
  VALUES (auth.uid(), auth.uid(), p_score, 30, p_passed);

  -- Si aprobó, pasar a 'approved'
  IF p_passed THEN
    UPDATE public.pawwer
    SET status = 'approved'
    WHERE id = auth.uid()
      AND status = 'preselected';
  END IF;
END;
$$;
