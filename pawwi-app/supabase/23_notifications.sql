-- ============================================================
-- PAWWI — Sistema de notificaciones (feed real)
-- Correr en Supabase SQL Editor después de 22_booking_timing.sql
--
-- Modelo: una fila por notificación dirigida a un usuario.
-- Tipos: 'cuidado' | 'mensaje' | 'pago' | 'noticia'.
--   - cuidado / mensaje: alimentados por triggers (ya operativos).
--   - pago / noticia:     reservados; se llenarán cuando existan
--                         el sistema de pagos y el Portal Admin.
-- ============================================================

-- ── 1. Tabla notifications ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  type         text        NOT NULL CHECK (type IN ('cuidado','mensaje','pago','noticia')),
  title        text        NOT NULL,
  body         text,
  booking_id   uuid        REFERENCES public.booking(id) ON DELETE CASCADE,
  actor_name   text,        -- denormalizado para pintar el feed sin joins
  actor_avatar text,
  link         text,        -- ruta de navegación al tocar
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 2. RLS — cada quien ve y marca solo lo suyo ───────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_own_select" ON public.notifications;
CREATE POLICY "notif_own_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_own_update" ON public.notifications;
CREATE POLICY "notif_own_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());
-- Los INSERT los hacen triggers SECURITY DEFINER, no los usuarios.

-- ── 3. Índice para contar no-leídas y ordenar el feed ─────────
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON public.notifications (user_id, read_at, created_at DESC);

-- ── 4. Realtime ───────────────────────────────────────────────
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- ── 5. Trigger: cuidado directo (fase 1) ──────────────────────
-- Al crear un booking ya asignado a un pawwer, le notifica.
-- Sin nombre del perro: dog_booking aún no existe en este punto.
CREATE OR REPLACE FUNCTION public.notify_direct_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name   text;
  v_avatar text;
BEGIN
  IF NEW.pawwer_id IS NOT NULL AND NEW.status_id = 1 THEN
    SELECT name, avatar_url INTO v_name, v_avatar
    FROM   public.profile WHERE id = NEW.client_id;

    INSERT INTO public.notifications
      (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
    VALUES
      (NEW.pawwer_id, 'cuidado',
       'Nueva solicitud de cuidado',
       COALESCE(v_name, 'Un cliente') || ' te eligió para un nuevo cuidado',
       NEW.id, v_name, v_avatar, '/pawwer/cuidados/' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_direct_booking ON public.booking;
CREATE TRIGGER trg_notify_direct_booking
  AFTER INSERT ON public.booking
  FOR EACH ROW EXECUTE FUNCTION public.notify_direct_booking();

-- ── 6. Trigger: candidato fase 2/3 ────────────────────────────
-- Cada fila nueva en booking_candidates = un pawwer notificado.
CREATE OR REPLACE FUNCTION public.notify_candidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_name      text;
  v_avatar    text;
BEGIN
  SELECT client_id INTO v_client_id
  FROM   public.booking WHERE id = NEW.booking_id;

  SELECT name, avatar_url INTO v_name, v_avatar
  FROM   public.profile WHERE id = v_client_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
  VALUES
    (NEW.pawwer_id, 'cuidado',
     'Nueva solicitud disponible',
     'Hay un cuidado cerca que encaja contigo. ¡Respóndelo rápido!',
     NEW.booking_id, v_name, v_avatar, '/pawwer/cuidados/' || NEW.booking_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_candidate ON public.booking_candidates;
CREATE TRIGGER trg_notify_candidate
  AFTER INSERT ON public.booking_candidates
  FOR EACH ROW EXECUTE FUNCTION public.notify_candidate();

-- ── 7. Trigger: mensaje nuevo ─────────────────────────────────
-- Notifica a la contraparte (no al emisor) del chat.
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

DROP TRIGGER IF EXISTS trg_notify_message ON public.messages;
CREATE TRIGGER trg_notify_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message();

-- ── 8. get_notifications — feed del usuario ───────────────────
CREATE OR REPLACE FUNCTION public.get_notifications(p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(n ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT id, type, title, body, booking_id,
           actor_name, actor_avatar, link, read_at, created_at
    FROM   public.notifications
    WHERE  user_id = auth.uid()
    ORDER  BY created_at DESC
    LIMIT  p_limit
  ) n;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_notifications(int) TO authenticated;

-- ── 9. get_notif_counts — no-leídas por tipo ──────────────────
CREATE OR REPLACE FUNCTION public.get_notif_counts()
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
    'total',   COUNT(*),
    'cuidado', COUNT(*) FILTER (WHERE type = 'cuidado'),
    'mensaje', COUNT(*) FILTER (WHERE type = 'mensaje'),
    'pago',    COUNT(*) FILTER (WHERE type = 'pago'),
    'noticia', COUNT(*) FILTER (WHERE type = 'noticia')
  )
  INTO v_result
  FROM public.notifications
  WHERE user_id = auth.uid() AND read_at IS NULL;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_notif_counts() TO authenticated;

-- ── 10. mark_notifications_read — por tipo y/o booking ────────
CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_type       text DEFAULT NULL,
  p_booking_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET    read_at = now()
  WHERE  user_id = auth.uid()
    AND  read_at IS NULL
    AND  (p_type       IS NULL OR type       = p_type)
    AND  (p_booking_id IS NULL OR booking_id = p_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read(text, uuid) TO authenticated;

-- ── 11. mark_notification_read — una sola ─────────────────────
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET    read_at = now()
  WHERE  id = p_id AND user_id = auth.uid() AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- ── 12. mark_messages_seen — al abrir un chat ─────────────────
-- Marca como vistos los mensajes de la contraparte y baja el
-- contador de notificaciones tipo 'mensaje' de ese booking.
CREATE OR REPLACE FUNCTION public.mark_messages_seen(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: solo una parte del booking puede marcar
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id = p_booking_id
      AND (client_id = auth.uid() OR pawwer_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este chat';
  END IF;

  UPDATE public.messages
  SET    seen_at = now()
  WHERE  booking_id = p_booking_id
    AND  sender_id <> auth.uid()
    AND  seen_at IS NULL;

  UPDATE public.notifications
  SET    read_at = now()
  WHERE  user_id    = auth.uid()
    AND  type       = 'mensaje'
    AND  booking_id = p_booking_id
    AND  read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_seen(uuid) TO authenticated;
