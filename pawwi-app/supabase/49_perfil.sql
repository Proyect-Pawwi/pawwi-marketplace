-- ============================================================
-- PAWWI — Pantalla "Mi Perfil" (Centro de Control): columnas + RPCs
-- Correr en Supabase SQL Editor después de 48_payments_ledger.sql
--
-- La escritura directa a public.pawwer / service_X_Pawwer está REVOCADA (mig 44),
-- así que toda edición del perfil pasa por RPCs SECURITY DEFINER scopeadas a
-- auth.uid(). FAQ reusa la columna jsonb pawwer.faqs (no tabla nueva). Los datos
-- de pago son PII: se escriben por RPC y se leen ENMASCARADOS (get_pawwer_pago).
-- El gestor de "Fotos del hogar" (Pawwer_images + bucket) va en su propia
-- migración (50) al construir ese módulo.
-- ============================================================

-- ── 1. Columnas nuevas ────────────────────────────────────────
ALTER TABLE public.pawwer
  ADD COLUMN IF NOT EXISTS accepting_bookings boolean NOT NULL DEFAULT true,  -- pausar perfil
  ADD COLUMN IF NOT EXISTS deactivated_at     timestamptz,                    -- soft-delete
  ADD COLUMN IF NOT EXISTS recepcion_desde    time,                           -- horario recepción
  ADD COLUMN IF NOT EXISTS recepcion_hasta    time,
  ADD COLUMN IF NOT EXISTS pago_banco         text DEFAULT '',                -- datos de pago (PII)
  ADD COLUMN IF NOT EXISTS pago_tipo_cuenta   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pago_numero        text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pago_titular       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pago_documento     text DEFAULT '';

ALTER TABLE public."service_X_Pawwer"
  ADD COLUMN IF NOT EXISTS max_size int NOT NULL DEFAULT 3;  -- tamaño máx (dog_size 1/2/3)

-- ── 2. update_pawwer_vitrina — edita la vitrina pública ───────
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
  p_valores          text
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
    valores          = COALESCE(p_valores, valores)
  WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_pawwer_vitrina(text, text, text[], text, text, text[], text, text[], boolean, text, text) TO authenticated;

-- ── 3. update_pawwer_faqs — reusa la columna jsonb pawwer.faqs ─
-- p_faqs = array de objetos {q,a}. Valida la forma y tope de 12.
CREATE OR REPLACE FUNCTION public.update_pawwer_faqs(p_faqs jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF jsonb_typeof(p_faqs) <> 'array' THEN RAISE EXCEPTION 'Formato de FAQ inválido'; END IF;
  IF jsonb_array_length(p_faqs) > 12 THEN RAISE EXCEPTION 'Máximo 12 preguntas'; END IF;

  UPDATE public.pawwer SET faqs = p_faqs WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_pawwer_faqs(jsonb) TO authenticated;

-- ── 4. Pausar perfil / horarios de recepción ──────────────────
CREATE OR REPLACE FUNCTION public.set_accepting_bookings(p_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE public.pawwer SET accepting_bookings = COALESCE(p_on, true) WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_accepting_bookings(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_recepcion_horario(p_desde time, p_hasta time)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE public.pawwer SET recepcion_desde = p_desde, recepcion_hasta = p_hasta WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_recepcion_horario(time, time) TO authenticated;

-- ── 5. Datos de pago — write-only + lectura enmascarada ───────
CREATE OR REPLACE FUNCTION public.update_pawwer_pago(
  p_banco text, p_tipo text, p_numero text, p_titular text, p_documento text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE public.pawwer SET
    pago_banco       = COALESCE(p_banco, pago_banco),
    pago_tipo_cuenta = COALESCE(p_tipo, pago_tipo_cuenta),
    -- si p_numero viene vacío/null, conservamos el número existente (write-only).
    pago_numero      = COALESCE(NULLIF(p_numero, ''), pago_numero),
    pago_titular     = COALESCE(p_titular, pago_titular),
    pago_documento   = COALESCE(p_documento, pago_documento)
  WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_pawwer_pago(text, text, text, text, text) TO authenticated;

-- Devuelve los datos de pago con el NÚMERO enmascarado (nunca el completo).
CREATE OR REPLACE FUNCTION public.get_pawwer_pago()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE v jsonb; n text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT jsonb_build_object(
    'banco', pago_banco, 'tipo_cuenta', pago_tipo_cuenta,
    'titular', pago_titular, 'documento', pago_documento,
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

-- ── 6. Servicios: activar/desactivar + reglas de mascotas ─────
CREATE OR REPLACE FUNCTION public.set_service_active(p_id_service int, p_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE public."service_X_Pawwer"
  SET   is_active = COALESCE(p_on, true)
  WHERE id_pawwer = auth.uid() AND id_service = p_id_service;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_service_active(int, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_service_rules(
  p_id_service int, p_max_animals int, p_max_size int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_max_animals < 1 OR p_max_animals > 10 THEN RAISE EXCEPTION 'Cantidad máxima inválida'; END IF;
  IF p_max_size NOT IN (1, 2, 3) THEN RAISE EXCEPTION 'Tamaño máximo inválido'; END IF;
  UPDATE public."service_X_Pawwer"
  SET   max_animals = p_max_animals, max_size = p_max_size
  WHERE id_pawwer = auth.uid() AND id_service = p_id_service;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_service_rules(int, int, int) TO authenticated;

-- ── 7. Desactivar cuenta (soft-delete) ────────────────────────
CREATE OR REPLACE FUNCTION public.deactivate_pawwer_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE public.pawwer
  SET deactivated_at = now(), accepting_bookings = false
  WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.deactivate_pawwer_account() TO authenticated;
