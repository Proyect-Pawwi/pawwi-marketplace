-- ============================================================
-- PAWWI — Bucket de fotos del chat (Supabase Storage)
-- Correr en Supabase SQL Editor después de 40_booking_times.sql
--
-- El pawwer (y luego el cliente) mandan fotos del peludo en el chat. Se suben
-- a Storage (NO base64 en la BD) y el mensaje guarda la URL pública en
-- messages.photo_url. Bucket público de lectura; insert solo autenticados.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-photos', 'chat-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (las fotos del chat son URLs públicas, como las de perros)
DROP POLICY IF EXISTS "chat_photos_public_read" ON storage.objects;
CREATE POLICY "chat_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-photos');

-- Subida: solo usuarios autenticados
DROP POLICY IF EXISTS "chat_photos_auth_insert" ON storage.objects;
CREATE POLICY "chat_photos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-photos');
