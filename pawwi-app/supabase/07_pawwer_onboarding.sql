-- ============================================================
-- PAWWI — PARTE 7: Onboarding Pawwer (RPC atómica)
-- Correr en Supabase SQL Editor
-- ============================================================

-- ── 1. Storage: bucket pawwer-avatars ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('pawwer-avatars', 'pawwer-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pawwer_avatars_upload" ON storage.objects;
DROP POLICY IF EXISTS "pawwer_avatars_read"   ON storage.objects;
DROP POLICY IF EXISTS "pawwer_avatars_delete" ON storage.objects;

CREATE POLICY "pawwer_avatars_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pawwer-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "pawwer_avatars_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'pawwer-avatars');

CREATE POLICY "pawwer_avatars_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pawwer-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 2. RPC: complete_pawwer_onboarding ─────────────────────────────────────
-- Crea la fila pawwer + sus servicios + siembra availability (60 días según
-- week_pattern) en una sola transacción. Debe correr DESPUÉS de que exista
-- la fila pawwer porque availability.pawwer_id referencia pawwer(id).
CREATE OR REPLACE FUNCTION public.complete_pawwer_onboarding(
  p_bio          text,
  p_profession   text,
  p_neighborhood text,
  p_lat          double precision,
  p_lng          double precision,
  p_week_pattern jsonb,
  p_services     jsonb   -- [{ "service_id": 1, "price": 45000 }, ...]
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

  INSERT INTO public.pawwer (id, bio, profession, neighborhood, lat, lng, week_pattern, price)
  VALUES (v_pawwer_id, p_bio, p_profession, p_neighborhood, p_lat, p_lng, p_week_pattern, COALESCE(v_first_price, 0));

  FOR v_svc IN SELECT * FROM jsonb_array_elements(p_services)
  LOOP
    INSERT INTO public."service_X_Pawwer" (id_pawwer, id_service, price, is_active)
    VALUES (v_pawwer_id, (v_svc->>'service_id')::int, (v_svc->>'price')::numeric, true);
  END LOOP;

  INSERT INTO public.availability (pawwer_id, date, slots_remaining)
  SELECT v_pawwer_id, d::date, 1
  FROM generate_series(current_date, current_date + 60, '1 day') d
  WHERE COALESCE((p_week_pattern->>(v_dow_names[EXTRACT(DOW FROM d)::int + 1]))::boolean, false)
  ON CONFLICT (pawwer_id, date) DO NOTHING;
END;
$$;
