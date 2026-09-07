-- ============================================================
-- PAWWI — A2: Reseñas seguras (crear + validar + antifraude)
-- Correr en Supabase SQL Editor después de 36_commission_by_rating.sql
--
-- Antes: no existía forma de crear reseñas (rating nunca se llenaba) y la RLS
-- permitía a cualquier cliente insertar reseñas arbitrarias (cualquier pawwer,
-- sin cuidado completado, repetidas). Ahora:
--   • create_review valida: reserva del cliente + status completada (4) +
--     pawwer real + una sola reseña por cuidado.
--   • UNIQUE(booking_id) a prueba de duplicados.
--   • Se cierra el INSERT directo por RLS: solo entra por la RPC.
-- (El trigger refresh_pawwer_rating de la mig. 27 recalcula el rating.)
-- ============================================================

-- ── Una reseña por cuidado (dedupe defensivo + UNIQUE) ────────
DELETE FROM public.reviews a
USING public.reviews b
WHERE a.booking_id = b.booking_id AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_booking ON public.reviews (booking_id);

-- ── Cerrar el INSERT directo: solo vía create_review ──────────
DROP POLICY IF EXISTS "reviews_client_write" ON public.reviews;
-- (reviews_public_read se mantiene: las reseñas son públicas de lectura.)

-- ── create_review — validada y antifraude ────────────────────
CREATE OR REPLACE FUNCTION public.create_review(
  p_booking_id uuid,
  p_rating     numeric,
  p_comment    text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_pawwer uuid;
  v_status int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'Debes iniciar sesión');
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN json_build_object('error', 'Calificación inválida (1 a 5)');
  END IF;

  SELECT pawwer_id, status_id INTO v_pawwer, v_status
  FROM   public.booking
  WHERE  id = p_booking_id AND client_id = v_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Reserva no encontrada');
  END IF;
  IF v_status <> 4 THEN
    RETURN json_build_object('error', 'Solo puedes calificar cuidados completados');
  END IF;
  IF v_pawwer IS NULL THEN
    RETURN json_build_object('error', 'Esta reserva no tuvo cuidador');
  END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE booking_id = p_booking_id) THEN
    RETURN json_build_object('error', 'Ya calificaste este cuidado');
  END IF;

  INSERT INTO public.reviews (booking_id, client_id, pawwer_id, rating, comment)
  VALUES (p_booking_id, v_uid, v_pawwer, p_rating, NULLIF(TRIM(p_comment), ''));

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_review(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_review(uuid, numeric, text) TO authenticated;
