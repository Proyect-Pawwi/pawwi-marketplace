-- ============================================================
-- PAWWI — Mejoras de perfil: años de experiencia + pagos Bre-B + PDF obligatorio
-- Correr en Supabase SQL Editor después de 52_transport_price.sql
--
-- #4: pawwer.years_experience (para el stat de años en el perfil público) →
--     update_pawwer_vitrina lo recibe.
-- #5: método de pago con LLAVE Bre-B y/o CUENTA + certificación bancaria (PDF)
--     OBLIGATORIA para guardar. El PDF va a un bucket PRIVADO (pago-docs),
--     como cedula-docs (mig 10).
-- ============================================================

-- ── 1. Columnas nuevas ────────────────────────────────────────
ALTER TABLE public.pawwer
  ADD COLUMN IF NOT EXISTS years_experience int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pago_llave_tipo  text DEFAULT '',   -- celular|correo|cedula|alfanumerica
  ADD COLUMN IF NOT EXISTS pago_llave_valor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pago_cert_url    text DEFAULT '';    -- path en bucket privado pago-docs

-- ── 2. Bucket privado para la certificación bancaria (PDF) ────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pago-docs', 'pago-docs', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pago_docs_insert" ON storage.objects;
CREATE POLICY "pago_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pago-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "pago_docs_select_own" ON storage.objects;
CREATE POLICY "pago_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pago-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "pago_docs_update_own" ON storage.objects;
CREATE POLICY "pago_docs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pago-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 3. update_pawwer_vitrina: + años de experiencia ──────────
DROP FUNCTION IF EXISTS public.update_pawwer_vitrina(text, text, text[], text, text, text[], text, text[], boolean, text, text);

CREATE OR REPLACE FUNCTION public.update_pawwer_vitrina(
  p_profession       text,
  p_bio              text,
  p_experience       text[],
  p_response_time    text,
  p_neighborhood     text,
  p_animales_en_casa text[],
  p_tipo_inmueble    text,
  p_areas_externas   text[],
  p_ninos_pequenos   boolean,
  p_mi_espacio       text,
  p_valores          text,
  p_years            int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_bio IS NOT NULL AND char_length(p_bio) > 500 THEN
    RAISE EXCEPTION 'La bio no puede superar 500 caracteres';
  END IF;

  UPDATE public.pawwer SET
    profession       = COALESCE(p_profession, profession),
    bio              = COALESCE(p_bio, bio),
    experience       = COALESCE(p_experience, experience),
    response_time    = COALESCE(p_response_time, response_time),
    neighborhood     = COALESCE(p_neighborhood, neighborhood),
    animales_en_casa = COALESCE(p_animales_en_casa, animales_en_casa),
    tipo_inmueble    = COALESCE(p_tipo_inmueble, tipo_inmueble),
    areas_externas   = COALESCE(p_areas_externas, areas_externas),
    ninos_pequenos   = COALESCE(p_ninos_pequenos, ninos_pequenos),
    mi_espacio       = COALESCE(p_mi_espacio, mi_espacio),
    valores          = COALESCE(p_valores, valores),
    years_experience = COALESCE(p_years, years_experience)
  WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_pawwer_vitrina(text, text, text[], text, text, text[], text, text[], boolean, text, text, int) TO authenticated;

-- ── 4. update_pawwer_pago: + llave Bre-B + cert PDF obligatorio ─
DROP FUNCTION IF EXISTS public.update_pawwer_pago(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_pawwer_pago(
  p_banco text, p_tipo text, p_numero text, p_titular text, p_documento text,
  p_llave_tipo text, p_llave_valor text, p_cert_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert text; v_numero text; v_llave text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT pago_cert_url, pago_numero, pago_llave_valor
  INTO   v_cert, v_numero, v_llave
  FROM   public.pawwer WHERE id = auth.uid();

  -- Valores efectivos tras el update
  v_cert   := COALESCE(NULLIF(p_cert_path, ''), v_cert);      -- write-only (vacío conserva)
  v_numero := COALESCE(NULLIF(p_numero, ''), v_numero);        -- write-only
  v_llave  := COALESCE(p_llave_valor, v_llave);                -- '' sí limpia

  -- El PDF de certificación es OBLIGATORIO
  IF COALESCE(v_cert, '') = '' THEN
    RAISE EXCEPTION 'Debes adjuntar la certificación bancaria (PDF)';
  END IF;
  -- Al menos un método de pago
  IF COALESCE(v_numero, '') = '' AND COALESCE(v_llave, '') = '' THEN
    RAISE EXCEPTION 'Registra una llave Bre-B o una cuenta bancaria';
  END IF;

  UPDATE public.pawwer SET
    pago_banco       = COALESCE(p_banco, pago_banco),
    pago_tipo_cuenta = COALESCE(p_tipo, pago_tipo_cuenta),
    pago_numero      = COALESCE(NULLIF(p_numero, ''), pago_numero),
    pago_titular     = COALESCE(p_titular, pago_titular),
    pago_documento   = COALESCE(p_documento, pago_documento),
    pago_llave_tipo  = COALESCE(p_llave_tipo, pago_llave_tipo),
    pago_llave_valor = COALESCE(p_llave_valor, pago_llave_valor),
    pago_cert_url    = COALESCE(NULLIF(p_cert_path, ''), pago_cert_url)
  WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_pawwer_pago(text, text, text, text, text, text, text, text) TO authenticated;

-- ── 5. get_pawwer_pago: + llave + has_cert (número sigue enmascarado) ─
CREATE OR REPLACE FUNCTION public.get_pawwer_pago()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT jsonb_build_object(
    'banco', pago_banco, 'tipo_cuenta', pago_tipo_cuenta,
    'titular', pago_titular, 'documento', pago_documento,
    'llave_tipo', pago_llave_tipo, 'llave_valor', pago_llave_valor,
    'has_cert', pago_cert_url <> '',
    'numero_mask', CASE
      WHEN length(pago_numero) >= 4 THEN repeat('•', greatest(0, length(pago_numero) - 4)) || right(pago_numero, 4)
      WHEN pago_numero <> '' THEN repeat('•', length(pago_numero))
      ELSE '' END,
    'has_numero', pago_numero <> ''
  ) INTO v
  FROM public.pawwer WHERE id = auth.uid();
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pawwer_pago() TO authenticated;
