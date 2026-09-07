-- ============================================================
-- PAWWI — Blindaje del chat (auditoría de seguridad 2026-07-09)
-- Correr en Supabase SQL Editor después de 44_security_hardening.sql
--
-- Contexto: el cuadro de texto YA es seguro (no hay SQL injection —los params
-- van enlazados vía PostgREST y send_message usa INSERT parametrizado, sin SQL
-- dinámico— ni XSS —React escapa todo, no hay dangerouslySetInnerHTML). Los
-- riesgos residuales NO están en el texto sino en la foto y el bucket:
--
--   F1) p_photo_url era texto libre → se pinta como <img src>. Llamando la RPC
--       directo, alguien podía inyectar una URL externa (fuga de IP / carga de
--       contenido ajeno al abrir el chat). Fix: solo aceptar URLs de NUESTRO
--       bucket público chat-photos.
--   F2) Bucket público + subida sin restricción de ruta/tipo → se podía subir
--       phishing.html (content-type text/html) hospedado en el dominio, o
--       archivos enormes, o fotos en carpetas de otras reservas. Fix: limitar
--       MIME a imágenes, tamaño máximo, y scopear la carpeta a las reservas
--       del usuario.
--   F3) p_content sin límite de longitud → mensajes de varios MB. Fix: tope.
--
-- Además: se aprovecha para tensar la RLS de messages a solo-lectura (las
-- escrituras van únicamente por send_message/mark_messages_seen DEFINER).
-- ============================================================

-- ── 1. send_message endurecido (F1 + F3) ─────────────────────
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

  -- F3 · Longitud máxima (evita mensajes gigantes que inflan la BD)
  IF p_content IS NOT NULL AND char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'El mensaje es demasiado largo (máx. 2000 caracteres)';
  END IF;

  -- F1 · La foto SOLO puede ser una URL de nuestro bucket público chat-photos.
  -- Bloquea URLs externas, javascript:/data:, y cualquier <img src> ajeno.
  -- (Si algún día usas dominio propio para Storage, ajusta este patrón.)
  IF p_photo_url IS NOT NULL
     AND p_photo_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/chat-photos/' THEN
    RAISE EXCEPTION 'URL de imagen inválida';
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

-- ── 2. Bucket chat-photos: solo imágenes + tope de tamaño (F2) ─
-- Bloquea subir HTML/JS (phishing en el dominio) y archivos enormes.
UPDATE storage.buckets
SET file_size_limit   = 5242880,  -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'chat-photos';

-- ── 3. Subida scopeada a la carpeta de TUS reservas (F2) ──────
-- La ruta es "<booking_id>/<uuid>.jpg". Exigimos que el primer segmento sea
-- una reserva de la que el usuario es parte → no puede escribir en carpetas
-- ajenas ni fuera del patrón.
DROP POLICY IF EXISTS "chat_photos_auth_insert" ON storage.objects;
CREATE POLICY "chat_photos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT b.id::text FROM public.booking b
      WHERE b.client_id = auth.uid() OR b.pawwer_id = auth.uid()
    )
  );

-- ── 4. messages: RLS solo-lectura (defensa en profundidad) ────
-- Las escrituras ya solo pasan por send_message/mark_messages_seen (DEFINER) y
-- el grant directo se revocó (mig. 44). Tensamos la policy de FOR ALL a
-- FOR SELECT para que ni siquiera se evalúe una escritura directa por REST.
-- Realtime y las lecturas de la app siguen igual (necesitan SELECT).
DROP POLICY IF EXISTS "messages_parties" ON public.messages;
CREATE POLICY "messages_parties" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.booking b
      WHERE b.id = messages.booking_id
        AND (b.client_id = auth.uid() OR b.pawwer_id = auth.uid())
    )
  );

-- Verificación (opcional):
--   • Subir un .html a chat-photos → debe fallar (mime no permitido).
--   • send_message con p_photo_url='https://evil.com/x.jpg' → 'URL de imagen inválida'.
--   • send_message con 3000 chars → 'El mensaje es demasiado largo'.
