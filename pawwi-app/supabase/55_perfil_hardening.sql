-- ============================================================
-- PAWWI — Endurecimiento del perfil (defensa en profundidad)
-- Correr en Supabase SQL Editor después de 54_presence.sql
--
-- La inyección SQL ya es imposible (todo parametrizado) y el XSS también
-- (React escapa, sin dangerouslySetInnerHTML). Esto cierra la última rendija de
-- "texto libre": aunque un cliente malicioso salte la UI y llame los RPCs
-- directo, la BD solo guarda datos BIEN FORMADOS y ACOTADOS.
--
--   #1 update_pawwer_faqs → valida forma {q,a}, recorta longitudes, descarta
--      vacíos. Antes solo validaba que fuera array de ≤12 (un objeto raro podía
--      romper el render del perfil público).
--   #2 update_pawwer_pago → valida que la ruta del PDF sea de la carpeta propia
--      (<uid>/...), coherente con la RLS del bucket y con add_pawwer_image.
-- ============================================================

-- ── #1: FAQ — saneo + validación de forma y longitud ─────────────
CREATE OR REPLACE FUNCTION public.update_pawwer_faqs(p_faqs jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean jsonb := '[]'::jsonb;
  v_item  jsonb;
  v_q     text;
  v_a     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF jsonb_typeof(p_faqs) <> 'array' THEN RAISE EXCEPTION 'Formato de FAQ inválido'; END IF;
  IF jsonb_array_length(p_faqs) > 12 THEN RAISE EXCEPTION 'Máximo 12 preguntas'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_faqs) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Cada pregunta debe ser un objeto {q,a}';
    END IF;
    IF jsonb_typeof(v_item -> 'q') <> 'string' OR jsonb_typeof(v_item -> 'a') <> 'string' THEN
      RAISE EXCEPTION 'La pregunta y la respuesta deben ser texto';
    END IF;
    -- Recorte defensivo (holgado sobre los topes de la UI: 120/400).
    v_q := btrim(left(v_item ->> 'q', 200));
    v_a := btrim(left(v_item ->> 'a', 600));
    IF v_q <> '' AND v_a <> '' THEN
      v_clean := v_clean || jsonb_build_object('q', v_q, 'a', v_a);
    END IF;
  END LOOP;

  UPDATE public.pawwer SET faqs = v_clean WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_pawwer_faqs(jsonb) TO authenticated;

-- ── #2: Pago — valida la ruta del PDF (carpeta propia) ───────────
-- Misma firma de 8 args creada en la mig 53 → CREATE OR REPLACE (sin DROP).
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

  -- La ruta del PDF debe vivir en la carpeta del propio usuario (como la RLS
  -- del bucket pago-docs). Evita guardar rutas ajenas o basura.
  IF COALESCE(p_cert_path, '') <> '' AND p_cert_path NOT LIKE (auth.uid()::text || '/%') THEN
    RAISE EXCEPTION 'Ruta de certificación inválida';
  END IF;

  SELECT pago_cert_url, pago_numero, pago_llave_valor
  INTO   v_cert, v_numero, v_llave
  FROM   public.pawwer WHERE id = auth.uid();

  -- Valores efectivos tras el update
  v_cert   := COALESCE(NULLIF(p_cert_path, ''), v_cert);   -- write-only (vacío conserva)
  v_numero := COALESCE(NULLIF(p_numero, ''), v_numero);     -- write-only
  v_llave  := COALESCE(p_llave_valor, v_llave);             -- '' sí limpia

  IF COALESCE(v_cert, '') = '' THEN
    RAISE EXCEPTION 'Debes adjuntar la certificación bancaria (PDF)';
  END IF;
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
