-- ============================================================
-- PAWWI — A4: Cancelación por el CLIENTE
-- Correr en Supabase SQL Editor después de 37_reviews.sql
--
-- Antes: solo el pawwer podía cancelar (cancel_booking). El cliente no tenía
-- forma de cancelar su propia reserva. Ahora puede cancelar ANTES de que el
-- cuidado inicie (pendiente=1 o confirmada=2). Si estaba confirmada, se libera
-- el cupo que se había bloqueado al aceptar, y se le avisa al pawwer.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_booking_client(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b      public.booking%ROWTYPE;
  v_name   text;
  v_avatar text;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND client_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;
  IF v_b.status_id NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Solo puedes cancelar antes de que inicie el cuidado';
  END IF;

  -- Liberar cupo solo si estaba confirmada (accept_booking lo había descontado;
  -- una solicitud pendiente nunca descuenta bajo el modelo actual).
  IF v_b.status_id = 2 AND v_b.pawwer_id IS NOT NULL THEN
    UPDATE public.availability
    SET   slots_remaining = slots_remaining + 1
    WHERE pawwer_id = v_b.pawwer_id
      AND date BETWEEN v_b.start_date AND v_b.end_date;
  END IF;

  UPDATE public.booking SET status_id = 5 WHERE id = p_booking_id;
  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;

  -- Avisar al pawwer asignado (si lo hay)
  IF v_b.pawwer_id IS NOT NULL THEN
    SELECT name, avatar_url INTO v_name, v_avatar FROM public.profile WHERE id = auth.uid();

    INSERT INTO public.notifications
      (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
    VALUES
      (v_b.pawwer_id, 'cuidado', 'Cuidado cancelado por el cliente',
       COALESCE(v_name, 'El cliente') || ' canceló su reserva.',
       p_booking_id, v_name, v_avatar, '/pawwer/cuidados/' || p_booking_id);

    -- Mensaje de sistema en el chat (solo si ya había chat = estaba confirmada)
    IF v_b.status_id = 2 THEN
      INSERT INTO public.messages (booking_id, sender_id, content, is_system)
      VALUES (p_booking_id, NULL, 'El cliente canceló este cuidado. 😔', true);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking_client(uuid) TO authenticated;
