-- ============================================================
-- 10_pawwer_cedula_docs.sql
-- Columnas para fotos de cédula + bucket privado de Storage
-- ============================================================

-- 1. Columnas en la tabla pawwer
ALTER TABLE public.pawwer
  ADD COLUMN IF NOT EXISTS cedula_front_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cedula_back_url  TEXT DEFAULT '';

-- 2. Bucket privado para documentos de identidad
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cedula-docs',
  'cedula-docs',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Storage: cada Pawwer solo puede subir/ver sus propios archivos
CREATE POLICY "cedula_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cedula-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "cedula_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cedula-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- El equipo admin accede directamente desde el dashboard de Supabase
-- (service_role bypasses RLS).
