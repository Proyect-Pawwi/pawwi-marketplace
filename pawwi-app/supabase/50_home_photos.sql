-- ============================================================
-- PAWWI — Fotos del hogar (gestor del perfil): Pawwer_images + bucket
-- Correr en Supabase SQL Editor después de 49_perfil.sql
--
-- Pawwer_images es tabla base (columna `image` = URL). Su columna FK al pawwer
-- puede llamarse `pawwer_id` o `id_pawwer` según el esquema, así que la
-- DETECTAMOS y creamos RPCs que la encapsulan (SECURITY DEFINER). El front solo
-- llama las RPCs con la URL — nunca necesita saber el nombre de la columna.
--   • get_pawwer_images()          → [{url, sort_order}] del pawwer, ordenado.
--   • add_pawwer_image(url)        → inserta (máx 8, valida que la URL sea del
--                                    bucket pawwer-images).
--   • delete_pawwer_image(url)     → borra la fila del pawwer.
--   • reorder_pawwer_images(urls[])→ reordena por posición del array.
-- Las fotos se suben al bucket público `pawwer-images`.
-- ============================================================

-- ── 1. Columna de orden ───────────────────────────────────────
ALTER TABLE public."Pawwer_images" ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- ── 2. RPCs (columna FK detectada dinámicamente) ──────────────
DO $do$
DECLARE v_col text;
BEGIN
  SELECT column_name INTO v_col
  FROM   information_schema.columns
  WHERE  table_schema = 'public' AND table_name = 'Pawwer_images'
    AND  column_name IN ('pawwer_id', 'id_pawwer')
  LIMIT 1;

  IF v_col IS NULL THEN
    RAISE EXCEPTION 'No encontré la columna FK (pawwer_id/id_pawwer) en Pawwer_images';
  END IF;

  EXECUTE format($tpl$
    CREATE OR REPLACE FUNCTION public.get_pawwer_images()
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $fn$
    DECLARE v jsonb;
    BEGIN
      IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('url', image, 'sort_order', sort_order)
                                ORDER BY sort_order, image), '[]'::jsonb)
      INTO v FROM public."Pawwer_images" WHERE %1$I = auth.uid();
      RETURN v;
    END; $fn$;
  $tpl$, v_col);

  EXECUTE format($tpl$
    CREATE OR REPLACE FUNCTION public.add_pawwer_image(p_url text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
    BEGIN
      IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
      IF p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/pawwer-images/' THEN
        RAISE EXCEPTION 'URL de imagen inválida';
      END IF;
      IF (SELECT count(*) FROM public."Pawwer_images" WHERE %1$I = auth.uid()) >= 8 THEN
        RAISE EXCEPTION 'Máximo 8 fotos';
      END IF;
      INSERT INTO public."Pawwer_images" (%1$I, image, sort_order)
      VALUES (auth.uid(), p_url,
              COALESCE((SELECT max(sort_order) + 1 FROM public."Pawwer_images" WHERE %1$I = auth.uid()), 0));
    END; $fn$;
  $tpl$, v_col);

  EXECUTE format($tpl$
    CREATE OR REPLACE FUNCTION public.delete_pawwer_image(p_url text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
    BEGIN
      IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
      DELETE FROM public."Pawwer_images" WHERE image = p_url AND %1$I = auth.uid();
    END; $fn$;
  $tpl$, v_col);

  EXECUTE format($tpl$
    CREATE OR REPLACE FUNCTION public.reorder_pawwer_images(p_urls text[])
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
    BEGIN
      IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
      UPDATE public."Pawwer_images" pi SET sort_order = u.idx
      FROM (SELECT url, (ord - 1) AS idx
            FROM unnest(p_urls) WITH ORDINALITY AS t(url, ord)) u
      WHERE pi.image = u.url AND pi.%1$I = auth.uid();
    END; $fn$;
  $tpl$, v_col);
END $do$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_images()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_pawwer_image(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_pawwer_image(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_pawwer_images(text[])   TO authenticated;

-- ── 3. Bucket de Storage pawwer-images ────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pawwer-images', 'pawwer-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pawwer_images_bucket_read" ON storage.objects;
CREATE POLICY "pawwer_images_bucket_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'pawwer-images');

-- Subida/borrado scopeado a la carpeta propia ("<uid>/archivo.jpg").
DROP POLICY IF EXISTS "pawwer_images_bucket_insert" ON storage.objects;
CREATE POLICY "pawwer_images_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pawwer-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "pawwer_images_bucket_delete" ON storage.objects;
CREATE POLICY "pawwer_images_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pawwer-images' AND (storage.foldername(name))[1] = auth.uid()::text);
