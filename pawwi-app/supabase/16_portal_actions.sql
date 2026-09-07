-- ============================================================
-- PAWWI — Portal Pawwer: RPCs y configuración de mensajería
-- Correr en Supabase SQL Editor
-- ============================================================

-- ── 1. Publicación Realtime para mensajes ────────────────────────────────
ALTER TABLE public.messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- ── 2. Política dog para pawwers con reservas activas ────────────────────
DROP POLICY IF EXISTS "dog_booking_visible" ON public.dog;
CREATE POLICY "dog_booking_visible" ON public.dog
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dog_booking db
      JOIN  public.booking b ON b.id = db.booking_id
      WHERE db.dog_id = dog.id
        AND b.pawwer_id = auth.uid()
    )
  );

-- ── 3. accept_booking ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id        = p_booking_id
      AND pawwer_id = auth.uid()
      AND status_id = 1
  ) THEN
    RAISE EXCEPTION 'Reserva no encontrada o ya no está pendiente';
  END IF;

  UPDATE public.booking
  SET status_id = 2
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;

-- ── 4. decline_booking ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decline_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.booking%ROWTYPE;
BEGIN
  SELECT * INTO v_b
  FROM  public.booking
  WHERE id        = p_booking_id
    AND pawwer_id = auth.uid()
    AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada o ya no está pendiente';
  END IF;

  -- Devolver slots de disponibilidad
  UPDATE public.availability
  SET   slots_remaining = slots_remaining + 1
  WHERE pawwer_id = v_b.pawwer_id
    AND date BETWEEN v_b.start_date AND v_b.end_date;

  UPDATE public.booking
  SET status_id = 5
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_booking(uuid) TO authenticated;

-- ── 5. get_pawwer_stats ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pawwer_stats(p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'bookings_completed', COUNT(*)    FILTER (WHERE status_id = 4 AND start_date BETWEEN p_start AND p_end),
    'pawwer_earnings',    COALESCE(SUM(pawwer_payout) FILTER (WHERE status_id = 4 AND start_date BETWEEN p_start AND p_end), 0),
    'active_bookings',    COUNT(*)    FILTER (WHERE status_id = 3),
    'pending_bookings',   COUNT(*)    FILTER (WHERE status_id = 1)
  )
  INTO v_result
  FROM public.booking
  WHERE pawwer_id = auth.uid();

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_stats(date, date) TO authenticated;

-- ── 6. send_message ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_message(
  p_booking_id uuid,
  p_content    text,
  p_photo_url  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id        = p_booking_id
      AND (client_id = auth.uid() OR pawwer_id = auth.uid())
      AND status_id IN (2, 3)
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este chat';
  END IF;

  IF (p_content IS NULL OR trim(p_content) = '') AND p_photo_url IS NULL THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío';
  END IF;

  INSERT INTO public.messages (booking_id, sender_id, content, photo_url)
  VALUES (p_booking_id, auth.uid(), p_content, p_photo_url)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text) TO authenticated;

-- ── 7. get_pawwer_bookings ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pawwer_bookings(p_status_ids int[])
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
      'id',           b.id,
      'start_date',   b.start_date,
      'end_date',     b.end_date,
      'total',        b.total,
      'pawwer_payout',b.pawwer_payout,
      'status_id',    b.status_id,
      'created_at',   b.created_at,
      'comments',     b.comments,
      'service_type', st.name,
      'client', jsonb_build_object(
        'id',         p.id,
        'name',       p.name,
        'avatar_url', p.avatar_url
      ),
      'dogs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name',      d.name,
          'breed',     d.breed,
          'photo_url', d.photo_url
        ))
        FROM public.dog_booking db
        JOIN public.dog d ON d.id = db.dog_id
        WHERE db.booking_id = b.id
      ), '[]'::jsonb)
    )
    ORDER BY b.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p      ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.pawwer_id   = auth.uid()
    AND b.status_id   = ANY(p_status_ids);

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_bookings(int[]) TO authenticated;

-- ── 8. get_pawwer_booking_detail ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pawwer_booking_detail(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',           b.id,
    'start_date',   b.start_date,
    'end_date',     b.end_date,
    'total',        b.total,
    'pawwer_payout',b.pawwer_payout,
    'status_id',    b.status_id,
    'created_at',   b.created_at,
    'comments',     b.comments,
    'service_type', st.name,
    'client', jsonb_build_object(
      'id',         p.id,
      'name',       p.name,
      'avatar_url', p.avatar_url
    ),
    'dogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name',      d.name,
        'breed',     d.breed,
        'photo_url', d.photo_url
      ))
      FROM  public.dog_booking db
      JOIN  public.dog d ON d.id = db.dog_id
      WHERE db.booking_id = b.id
    ), '[]'::jsonb),
    'review', (
      SELECT jsonb_build_object('rating', r.rating, 'comment', r.comment)
      FROM  public.reviews r
      WHERE r.booking_id = b.id
      LIMIT 1
    )
  )
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p      ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.id        = p_booking_id
    AND b.pawwer_id = auth.uid();

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_booking_detail(uuid) TO authenticated;

-- ── 9. update_pawwer_profile ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_pawwer_profile(
  p_bio         text,
  p_experiencia text,
  p_neighborhood text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pawwer
  SET bio          = p_bio,
      experiencia  = p_experiencia,
      neighborhood = p_neighborhood
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pawwer_profile(text, text, text) TO authenticated;

-- ── 10. update_service_price ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_service_price(
  p_service_id int,
  p_price      numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_price < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  UPDATE public."service_X_Pawwer"
  SET   price = p_price
  WHERE id_pawwer  = auth.uid()
    AND id_service = p_service_id;

  IF NOT FOUND THEN
    INSERT INTO public."service_X_Pawwer" (id_pawwer, id_service, price, is_active)
    VALUES (auth.uid(), p_service_id, p_price, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_service_price(int, numeric) TO authenticated;

-- ── 11. FK guard para service_X_Pawwer.id_service ────────────────────────────
-- Previene que update_service_price inserte filas huérfanas con id_service inválido.
-- Idempotente: solo agrega la constraint si no existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'service_X_Pawwer'
      AND constraint_name = 'fk_service_x_pawwer_service_type'
  ) THEN
    ALTER TABLE public."service_X_Pawwer"
      ADD CONSTRAINT fk_service_x_pawwer_service_type
      FOREIGN KEY (id_service) REFERENCES public.service_type(id);
  END IF;
END;
$$;
