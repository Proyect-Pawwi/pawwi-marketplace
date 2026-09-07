-- ============================================================
-- PAWWI — Mensaje de sistema en el chat
-- Correr en Supabase SQL Editor después de 29_transport.sql
--
-- Al aceptar una reserva se inserta un mensaje "de sistema" en el chat
-- (sender_id NULL, is_system=true) que el front renderiza como una
-- tarjeta de "Resumen del cuidado". Es el mensaje predeterminado que
-- conecta a cliente y pawwer.
-- ============================================================

-- ── 1. Columnas / nulabilidad en messages ────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;  -- sistema = sin emisor

-- ── 2. accept_booking — inserta el mensaje de sistema ─────────
CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.booking%ROWTYPE;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no disponible o ya fue tomada';
  END IF;

  -- Acceso: fase 1 (pawwer directo) o candidato fase 2/3
  IF v_b.pawwer_id IS DISTINCT FROM auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_candidates
      WHERE booking_id = p_booking_id AND pawwer_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a esta reserva';
    END IF;
  END IF;

  UPDATE public.booking
  SET status_id = 2,
      pawwer_id = auth.uid()
  WHERE id = p_booking_id;

  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;

  -- Mensaje predeterminado que abre el chat para ambos
  INSERT INTO public.messages (booking_id, sender_id, content, is_system)
  VALUES (p_booking_id, NULL,
          '¡Reserva confirmada! Coordinen aquí los detalles del cuidado. 🐾',
          true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;

-- ── 3. notify_message — ignora los mensajes de sistema ────────
-- (Si no, cada aceptación generaría una notificación de "mensaje" falsa.)
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_pawwer uuid;
  v_recipient uuid;
  v_name   text;
  v_avatar text;
BEGIN
  IF NEW.is_system OR NEW.sender_id IS NULL THEN
    RETURN NEW;  -- los mensajes de sistema no generan notificación de chat
  END IF;

  SELECT client_id, pawwer_id INTO v_client, v_pawwer
  FROM   public.booking WHERE id = NEW.booking_id;

  v_recipient := CASE WHEN NEW.sender_id = v_client THEN v_pawwer ELSE v_client END;
  IF v_recipient IS NULL THEN RETURN NEW; END IF;

  SELECT name, avatar_url INTO v_name, v_avatar
  FROM   public.profile WHERE id = NEW.sender_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
  VALUES
    (v_recipient, 'mensaje',
     COALESCE(v_name, 'Mensaje nuevo'),
     LEFT(NEW.content, 80),
     NEW.booking_id, v_name, v_avatar, '/pawwer/mensajes/' || NEW.booking_id);

  RETURN NEW;
END;
$$;
