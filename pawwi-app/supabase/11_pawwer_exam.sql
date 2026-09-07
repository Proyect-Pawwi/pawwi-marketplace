-- ============================================================
-- 11_pawwer_exam.sql
-- Estado del pawwer + tabla de resultados del examen psicotécnico
-- ============================================================

-- 1. Columna de estado en la tabla pawwer
ALTER TABLE public.pawwer
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review';

-- Restricción de valores válidos (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'pawwer' AND constraint_name = 'pawwer_status_check'
  ) THEN
    ALTER TABLE public.pawwer
      ADD CONSTRAINT pawwer_status_check
      CHECK (status IN ('pending_review','exam_ready','preselected','needs_review','rejected','approved'));
  END IF;
END $$;

-- 2. Tabla de resultados del examen
CREATE TABLE IF NOT EXISTS public.exam_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pawwer_id   UUID NOT NULL REFERENCES public.pawwer(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  responses   JSONB NOT NULL,       -- { questionId: answerIndex | scaleValue }
  total_score INTEGER NOT NULL,
  result      TEXT NOT NULL,        -- 'preselected' | 'needs_review' | 'rejected'
  taken_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pawwer_id)                -- un solo intento por pawwer
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'exam_results' AND policyname = 'exam_own'
  ) THEN
    EXECUTE 'CREATE POLICY "exam_own" ON public.exam_results FOR ALL USING (user_id = auth.uid())';
  END IF;
END $$;

-- 3. Índice útil para la vista admin
CREATE INDEX IF NOT EXISTS exam_results_result_idx ON public.exam_results (result);
