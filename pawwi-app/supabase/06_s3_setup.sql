-- ============================================================
-- PAWWI — PARTE 6: S3 Setup
-- Correr en Supabase SQL Editor
-- ============================================================

-- ── 1. Fix booking check constraint (permite mismo día para DayCare/Express) ─
ALTER TABLE public.booking DROP CONSTRAINT IF EXISTS chk_booking_dates;
ALTER TABLE public.booking ADD CONSTRAINT chk_booking_dates CHECK (end_date >= start_date);

-- ── 2. Columnas opcionales en dog (si no existen) ─────────────────────────────
ALTER TABLE public.dog
  ADD COLUMN IF NOT EXISTS photo_url  text,
  ADD COLUMN IF NOT EXISTS age        integer,
  ADD COLUMN IF NOT EXISTS notes      text;

-- ── 3. Hacer client.city nullable (MVP — barrio no es requerido al registro) ──
ALTER TABLE public.client ALTER COLUMN city DROP NOT NULL;

-- ── 4. Trigger: auto-crear client al crear profile con role='client' ──────────
CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'client' THEN
    INSERT INTO public.client (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_client_created ON public.profile;
CREATE TRIGGER on_profile_client_created
  AFTER INSERT ON public.profile
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_client();

-- Backfill: crear client para perfiles 'client' ya existentes
INSERT INTO public.client (id)
SELECT id FROM public.profile WHERE role = 'client'
ON CONFLICT DO NOTHING;

-- ── 5. RLS para client ────────────────────────────────────────────────────────
ALTER TABLE public.client ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_own" ON public.client;
CREATE POLICY "client_own" ON public.client
  FOR ALL USING (auth.uid() = id);

-- ── 6. RLS para dog_booking ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "dog_booking_parties" ON public.dog_booking;
CREATE POLICY "dog_booking_parties" ON public.dog_booking
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.booking b
      WHERE b.id = dog_booking.booking_id
        AND (b.client_id = auth.uid() OR b.pawwer_id = auth.uid())
    )
  );

-- ── 7. Supabase Storage: bucket dog-photos ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('dog-photos', 'dog-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dog_photos_upload"  ON storage.objects;
DROP POLICY IF EXISTS "dog_photos_read"    ON storage.objects;
DROP POLICY IF EXISTS "dog_photos_delete"  ON storage.objects;

CREATE POLICY "dog_photos_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dog-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "dog_photos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'dog-photos');

CREATE POLICY "dog_photos_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dog-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 8. RPC: create_booking (transacción atómica con control de concurrencia) ──
CREATE OR REPLACE FUNCTION public.create_booking(
  p_pawwer_id      uuid,
  p_start_date     date,
  p_end_date       date,
  p_service_type_id int,
  p_dog_ids        uuid[],
  p_notes          text    DEFAULT NULL,
  p_hours_count    int     DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id   uuid := auth.uid();
  v_price       numeric;
  v_days        int;
  v_total       numeric;
  v_commission  numeric;
  v_payout      numeric;
  v_booking_id  uuid;
  v_missing     int;
  v_dog_id      uuid;
BEGIN
  -- Asegurar que existe registro client
  INSERT INTO public.client (id) VALUES (v_client_id) ON CONFLICT DO NOTHING;

  -- Obtener precio del servicio
  SELECT price INTO v_price
  FROM public."service_X_Pawwer"
  WHERE id_pawwer = p_pawwer_id
    AND id_service = p_service_type_id
    AND is_active = true;

  IF v_price IS NULL THEN
    RETURN json_build_object('error', 'Servicio no disponible para este Pawwer');
  END IF;

  -- Verificar disponibilidad para cada fecha del rango (con lock para concurrencia)
  SELECT COUNT(*) INTO v_missing
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(dt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.pawwer_id = p_pawwer_id
      AND a.date = d.dt::date
      AND a.slots_remaining > 0
  );

  IF v_missing > 0 THEN
    RETURN json_build_object('error', 'No hay disponibilidad para las fechas seleccionadas');
  END IF;

  -- Lock y decrementar slots (control de concurrencia)
  PERFORM 1 FROM public.availability
  WHERE pawwer_id = p_pawwer_id
    AND date BETWEEN p_start_date AND p_end_date
  FOR UPDATE;

  UPDATE public.availability
  SET slots_remaining = slots_remaining - 1
  WHERE pawwer_id = p_pawwer_id
    AND date BETWEEN p_start_date AND p_end_date
    AND slots_remaining > 0;

  -- Calcular total y comisión (siempre en backend)
  v_days := (p_end_date - p_start_date) + 1;
  IF p_service_type_id = 4 THEN
    -- Express: precio por hora
    v_total := v_price * COALESCE(p_hours_count, 1);
  ELSE
    v_total := v_price * v_days;
  END IF;

  v_commission := ROUND(v_total * 0.25, 0);
  v_payout     := v_total - v_commission;

  -- Crear reserva
  INSERT INTO public.booking (
    client_id, pawwer_id, start_date, end_date,
    service_type_id, status_id,
    total, commission, pawwer_payout, hours_count
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date,
    p_service_type_id, 1,
    v_total, v_commission, v_payout, p_hours_count
  )
  RETURNING id INTO v_booking_id;

  -- Asociar mascotas a la reserva
  FOREACH v_dog_id IN ARRAY p_dog_ids LOOP
    INSERT INTO public.dog_booking (booking_id, dog_id)
    VALUES (v_booking_id, v_dog_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN json_build_object(
    'booking_id',    v_booking_id,
    'total',         v_total,
    'commission',    v_commission,
    'pawwer_payout', v_payout
  );
END;
$$;

-- ── 9. RPC: revert_booking (si el pago falla) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.revert_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_b public.booking%ROWTYPE;
BEGIN
  SELECT * INTO v_b FROM public.booking WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.availability
  SET slots_remaining = slots_remaining + 1
  WHERE pawwer_id = v_b.pawwer_id
    AND date BETWEEN v_b.start_date AND v_b.end_date;

  UPDATE public.booking SET status_id = 5 WHERE id = p_booking_id;
END;
$$;

-- ── 10. RPCs disponibilidad Pawwer ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_availability(
  p_pawwer_id uuid,
  p_date      date,
  p_slots     int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() != p_pawwer_id THEN
    RAISE EXCEPTION 'Solo el Pawwer puede gestionar su disponibilidad';
  END IF;
  INSERT INTO public.availability (pawwer_id, date, slots_remaining)
  VALUES (p_pawwer_id, p_date, p_slots)
  ON CONFLICT (pawwer_id, date) DO UPDATE SET slots_remaining = p_slots;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_availability(
  p_pawwer_id uuid,
  p_date      date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() != p_pawwer_id THEN
    RAISE EXCEPTION 'Solo el Pawwer puede gestionar su disponibilidad';
  END IF;
  DELETE FROM public.availability
  WHERE pawwer_id = p_pawwer_id AND date = p_date;
END;
$$;

-- ── 11. Seed: availability para los 10 Pawwers del seed (próximos 60 días) ───
-- Basado en week_pattern de cada Pawwer

-- Juliana (001): Mon–Fri  (dow 1,2,3,4,5)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000001', d::date, 1
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,2,3,4,5)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Andrés (002): Mon,Tue,Thu,Fri,Sat  (1,2,4,5,6)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000002', d::date, 1
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,2,4,5,6)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Maria (003): Mon,Tue,Wed,Fri,Sat,Sun  (1,2,3,5,6,0)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000003', d::date, 1
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,2,3,5,6,0)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Carla (004): Mon–Fri  (1,2,3,4,5)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000004', d::date, 2
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,2,3,4,5)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Felipe (005): Tue,Wed,Thu,Sat,Sun  (2,3,4,6,0)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000005', d::date, 1
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (2,3,4,6,0)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Sara (006): Mon–Sat  (1,2,3,4,5,6)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000006', d::date, 2
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,2,3,4,5,6)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- David (007): Mon–Fri  (1,2,3,4,5)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000007', d::date, 1
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,2,3,4,5)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Laura (008): Mon,Wed,Fri,Sat,Sun  (1,3,5,6,0)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000008', d::date, 1
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,3,5,6,0)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Camila (009): Mon,Tue,Thu,Fri  (1,2,4,5)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000009', d::date, 1
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (1,2,4,5)
ON CONFLICT (pawwer_id, date) DO NOTHING;

-- Tomás (010): Tue,Wed,Thu,Sat,Sun  (2,3,4,6,0)
INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT 'a1000000-0000-0000-0000-000000000010', d::date, 2
FROM generate_series(current_date, current_date + 60, '1 day') d
WHERE EXTRACT(DOW FROM d) IN (2,3,4,6,0)
ON CONFLICT (pawwer_id, date) DO NOTHING;
