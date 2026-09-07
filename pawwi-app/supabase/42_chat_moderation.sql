-- ============================================================
-- PAWWI — Moderación del chat en el SERVIDOR + errores claros
-- Correr en Supabase SQL Editor después de 41_chat_photos_bucket.sql
--
-- Antes la moderación (no correos/teléfonos) vivía SOLO en el cliente → se
-- podía saltar llamando la RPC directo. Ahora send_message la valida en la
-- BD (fuente de verdad). Además separa los errores para que el front muestre
-- la causa real (acceso vs estado vs contacto).
-- ============================================================

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
  -- Acceso: debe ser parte de la reserva
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id = p_booking_id AND (client_id = auth.uid() OR pawwer_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este chat';
  END IF;

  -- Estado: solo se puede escribir con el cuidado confirmado o en curso
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id = p_booking_id AND status_id IN (2, 3)
  ) THEN
    RAISE EXCEPTION 'El chat solo está disponible mientras el cuidado esté confirmado o en curso';
  END IF;

  -- No vacío
  IF (p_content IS NULL OR trim(p_content) = '') AND p_photo_url IS NULL THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío';
  END IF;

  -- Moderación: no compartir contacto (mantener la transacción en Pawwi).
  --  • correo:   algo@algo.dominio
  --  • teléfono: 7+ dígitos (con o sin espacios/./-)
  IF p_content IS NOT NULL AND (
       p_content ~  '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
    OR p_content ~  '(\d[ .\-]?){7,}'
  ) THEN
    RAISE EXCEPTION 'Por seguridad, no compartas correos ni números de teléfono en el chat';
  END IF;

  INSERT INTO public.messages (booking_id, sender_id, content, photo_url)
  VALUES (p_booking_id, auth.uid(), p_content, p_photo_url)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text) TO authenticated;
