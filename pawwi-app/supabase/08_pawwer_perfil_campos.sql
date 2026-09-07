-- PAWWI — PARTE 8: Campos adicionales del perfil Pawwer
-- Correr en Supabase SQL Editor DESPUÉS de 07_pawwer_onboarding.sql

-- ── 1. Nuevas columnas en la tabla pawwer ────────────────────────────────────
ALTER TABLE public.pawwer ADD COLUMN IF NOT EXISTS cedula           TEXT    DEFAULT '';
ALTER TABLE public.pawwer ADD COLUMN IF NOT EXISTS transport_price  INTEGER DEFAULT 0;
ALTER TABLE public.pawwer ADD COLUMN IF NOT EXISTS experiencia      TEXT    DEFAULT '';
ALTER TABLE public.pawwer ADD COLUMN IF NOT EXISTS animales_en_casa TEXT[]  DEFAULT '{}';
ALTER TABLE public.pawwer ADD COLUMN IF NOT EXISTS tipo_inmueble    TEXT    DEFAULT '';
ALTER TABLE public.pawwer ADD COLUMN IF NOT EXISTS areas_externas   TEXT[]  DEFAULT '{}';

-- ── 2. RPC actualizada con los nuevos campos ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_pawwer_onboarding(
  p_bio              text,
  p_profession       text,
  p_neighborhood     text,
  p_lat              double precision,
  p_lng              double precision,
  p_week_pattern     jsonb,
  p_services         jsonb,
  p_cedula           text    DEFAULT '',
  p_transport_price  integer DEFAULT 0,
  p_experiencia      text    DEFAULT '',
  p_animales_en_casa text[]  DEFAULT '{}',
  p_tipo_inmueble    text    DEFAULT '',
  p_areas_externas   text[]  DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pawwer_id   uuid := auth.uid();
  v_role        text;
  v_dow_names   text[] := ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  v_first_price numeric;
  v_svc         jsonb;
BEGIN
  IF v_pawwer_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_role FROM public.profile WHERE id = v_pawwer_id;
  IF v_role IS DISTINCT FROM 'pawwer' THEN
    RAISE EXCEPTION 'Solo cuentas Pawwer pueden completar este onboarding';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pawwer WHERE id = v_pawwer_id) THEN
    RAISE EXCEPTION 'Ya completaste tu onboarding';
  END IF;

  IF jsonb_array_length(p_services) < 1 THEN
    RAISE EXCEPTION 'Selecciona al menos un servicio';
  END IF;

  SELECT (p_services->0->>'price')::numeric INTO v_first_price;

  INSERT INTO public.pawwer (
    id, bio, profession, neighborhood, lat, lng, week_pattern, price,
    cedula, transport_price, experiencia, animales_en_casa, tipo_inmueble, areas_externas
  ) VALUES (
    v_pawwer_id, p_bio, p_profession, p_neighborhood, p_lat, p_lng, p_week_pattern,
    COALESCE(v_first_price, 0),
    p_cedula, p_transport_price, p_experiencia, p_animales_en_casa, p_tipo_inmueble, p_areas_externas
  );

  FOR v_svc IN SELECT * FROM jsonb_array_elements(p_services)
  LOOP
    INSERT INTO public."service_X_Pawwer" (id_pawwer, id_service, price, is_active)
    VALUES (v_pawwer_id, (v_svc->>'service_id')::int, (v_svc->>'price')::numeric, true);
  END LOOP;

  INSERT INTO public.availability (pawwer_id, date, slots_remaining)
  SELECT v_pawwer_id, d::date, 1
  FROM generate_series(current_date, current_date + 60, '1 day') d
  WHERE COALESCE(
    (p_week_pattern->>(v_dow_names[EXTRACT(DOW FROM d)::int + 1]))::boolean,
    false
  )
  ON CONFLICT (pawwer_id, date) DO NOTHING;
END;
$$;
