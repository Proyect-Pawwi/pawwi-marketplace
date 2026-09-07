-- RPC para actualizar el status del Pawwer luego del examen.
-- SECURITY DEFINER bypasea RLS (el update en server action falla silenciosamente con RLS).
-- Se valida que solo el propio pawwer pueda cambiar su propio status,
-- y solo hacia valores válidos de resultado de examen.

CREATE OR REPLACE FUNCTION public.set_pawwer_exam_result(p_result text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_result NOT IN ('preselected', 'needs_review', 'rejected') THEN
    RAISE EXCEPTION 'Resultado inválido: %', p_result;
  END IF;

  UPDATE public.pawwer
  SET status = p_result
  WHERE id = auth.uid()
    AND status = 'exam_ready';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pawwer no encontrado o estado inválido';
  END IF;
END;
$$;
