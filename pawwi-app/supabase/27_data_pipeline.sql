-- ============================================================
-- PAWWI — Tubería de datos (auditoría del schema, 2026-06-25)
-- Correr en Supabase SQL Editor después de 26_booking_pawwer_nullable.sql
--
-- Conecta la cadena signup → profile → booking para que las features de
-- hoy (distancia, zona, rating) tengan datos reales en producción:
--   H2 — handle_new_user persiste lat/lng del cliente (antes se perdían).
--   H1 — create_booking copia la ubicación del cliente al booking.
--   H4 — trigger que mantiene pawwer.rating / reviews_count al día.
--   M2 — UNIQUE faltantes (availability, booking_candidates) que necesitan
--        los ON CONFLICT del modelo de disponibilidad y escalación.
-- ============================================================

-- ── H2 — handle_new_user persiste latitude/longitude ──────────
-- registrarCliente manda lat/lng (centroide del barrio) en el metadata;
-- antes el trigger los descartaba. (Pawwers no traen lat/lng aquí: su
-- ubicación se setea en el onboarding sobre la tabla pawwer.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile (id, name, phone, role, neighborhood, latitude, longitude)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('client', 'pawwer')
        THEN NEW.raw_user_meta_data->>'role'
      ELSE 'client'
    END,
    COALESCE(NEW.raw_user_meta_data->>'neighborhood', ''),
    NULLIF(NEW.raw_user_meta_data->>'lat', '')::double precision,
    NULLIF(NEW.raw_user_meta_data->>'lng', '')::double precision
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill: clientes ya registrados cuyo lat/lng quedó solo en el metadata
UPDATE public.profile p
SET latitude  = NULLIF(u.raw_user_meta_data->>'lat', '')::double precision,
    longitude = NULLIF(u.raw_user_meta_data->>'lng', '')::double precision
FROM auth.users u
WHERE u.id = p.id
  AND p.latitude IS NULL
  AND NULLIF(u.raw_user_meta_data->>'lat', '') IS NOT NULL;

-- ── M2 — UNIQUE faltantes (con dedupe defensivo previo) ───────
-- Los ON CONFLICT de upsert_availability / escalación los necesitan.
DELETE FROM public.availability a
USING public.availability b
WHERE a.pawwer_id = b.pawwer_id AND a.date = b.date AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_availability_pawwer_date
  ON public.availability (pawwer_id, date);

DELETE FROM public.booking_candidates a
USING public.booking_candidates b
WHERE a.booking_id = b.booking_id AND a.pawwer_id = b.pawwer_id AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_candidates_booking_pawwer
  ON public.booking_candidates (booking_id, pawwer_id);

-- ── H1 — create_booking copia la ubicación del cliente ────────
-- (Mantiene todo el endurecimiento de la migración 25: valida dueño de
--  los perros, corta el race de overbooking, grants a authenticated.)
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
SET search_path = public
AS $$
DECLARE
  v_client_id    uuid := auth.uid();
  v_price        numeric;
  v_days         int;
  v_total        numeric;
  v_commission   numeric;
  v_payout       numeric;
  v_booking_id   uuid;
  v_missing      int;
  v_bad_dogs     int;
  v_updated      int;
  v_dog_id       uuid;
  v_lat          double precision;
  v_lng          double precision;
  v_neighborhood text;
BEGIN
  IF v_client_id IS NULL THEN
    RETURN json_build_object('error', 'Debes iniciar sesión');
  END IF;

  INSERT INTO public.client (id) VALUES (v_client_id) ON CONFLICT DO NOTHING;

  -- Ubicación del cliente (snapshot al momento de reservar)
  SELECT latitude, longitude, neighborhood
  INTO   v_lat, v_lng, v_neighborhood
  FROM   public.profile WHERE id = v_client_id;

  -- Validar que cada perro pertenece al cliente
  IF p_dog_ids IS NULL OR array_length(p_dog_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Selecciona al menos una mascota');
  END IF;

  SELECT COUNT(*) INTO v_bad_dogs
  FROM   unnest(p_dog_ids) did
  WHERE  NOT EXISTS (
    SELECT 1 FROM public.dog d WHERE d.id = did AND d.owner_id = v_client_id
  );
  IF v_bad_dogs > 0 THEN
    RETURN json_build_object('error', 'Una o más mascotas no te pertenecen');
  END IF;

  SELECT price INTO v_price
  FROM public."service_X_Pawwer"
  WHERE id_pawwer = p_pawwer_id
    AND id_service = p_service_type_id
    AND is_active = true;

  IF v_price IS NULL THEN
    RETURN json_build_object('error', 'Servicio no disponible para este Pawwer');
  END IF;

  v_days := (p_end_date - p_start_date) + 1;

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

  PERFORM 1 FROM public.availability
  WHERE pawwer_id = p_pawwer_id
    AND date BETWEEN p_start_date AND p_end_date
  FOR UPDATE;

  UPDATE public.availability
  SET slots_remaining = slots_remaining - 1
  WHERE pawwer_id = p_pawwer_id
    AND date BETWEEN p_start_date AND p_end_date
    AND slots_remaining > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated < v_days THEN
    RAISE EXCEPTION 'No hay disponibilidad para las fechas seleccionadas';
  END IF;

  IF p_service_type_id = 4 THEN
    v_total := v_price * COALESCE(p_hours_count, 1);
  ELSE
    v_total := v_price * v_days;
  END IF;
  v_commission := ROUND(v_total * 0.25, 0);
  v_payout     := v_total - v_commission;

  INSERT INTO public.booking (
    client_id, pawwer_id, start_date, end_date,
    service_type_id, status_id,
    total, commission, pawwer_payout, hours_count, comments,
    client_lat, client_lng, client_neighborhood
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date,
    p_service_type_id, 1,
    v_total, v_commission, v_payout, p_hours_count, p_notes,
    v_lat, v_lng, v_neighborhood
  )
  RETURNING id INTO v_booking_id;

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

REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int) TO authenticated;

-- ── H4 — pawwer.rating / reviews_count se mantienen solos ─────
-- Antes nada los recalculaba al insertar reseñas → quedaban en 0.
CREATE OR REPLACE FUNCTION public.refresh_pawwer_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pawwer uuid := COALESCE(NEW.pawwer_id, OLD.pawwer_id);
BEGIN
  UPDATE public.pawwer p SET
    rating = COALESCE(
      (SELECT ROUND(AVG(r.rating), 2) FROM public.reviews r WHERE r.pawwer_id = v_pawwer), 0
    ),
    reviews_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.pawwer_id = v_pawwer)
  WHERE p.id = v_pawwer;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_pawwer_rating ON public.reviews;
CREATE TRIGGER trg_refresh_pawwer_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_pawwer_rating();

-- Backfill de ratings ya existentes
UPDATE public.pawwer p SET
  rating = COALESCE(
    (SELECT ROUND(AVG(r.rating), 2) FROM public.reviews r WHERE r.pawwer_id = p.id), 0
  ),
  reviews_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.pawwer_id = p.id);
