-- ============================================================
-- PAWWI — Sistema de Niveles ("Tu Nivel": nuevo / super / ranger)
-- Correr en Supabase SQL Editor después de 55_perfil_hardening.sql
--
-- Un solo nivel por pawwer, calculado con compute_pawwer_level() (FUENTE ÚNICA):
--   • ranger: reviews≥15 ∧ rating≥4.8 ∧ cancel_rate≤0.02 ∧ activo 30d  → comisión 20%
--   • super : reviews≥5  ∧ rating≥4.5 ∧ cancel_rate≤0.10
--   • nuevo : piso.
-- cancel_rate = canceladas POR el pawwer / aceptadas (0 si no hay aceptadas).
-- activo 30d  = presencia (mig 54) O reserva aceptada/completada en 30 días.
--
-- Se guarda en pawwer.level (para ordenar el marketplace y leerlo barato). Se
-- recalcula por EVENTO (nueva reseña, cancelación del pawwer) y por CRON DIARIO
-- (transiciones por tiempo: 60 días de gracia / inactividad 30 días).
-- La comisión 20% se ata a Ranger en create_booking (se congela por reserva).
-- Idempotente.
-- ============================================================

-- ── 1. Columnas ───────────────────────────────────────────────
ALTER TABLE public.pawwer
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS level      text NOT NULL DEFAULT 'nuevo';

-- Backfill de created_at con la fecha de alta real (auth.users, siempre existe).
UPDATE public.pawwer p SET created_at = u.created_at
FROM auth.users u WHERE u.id = p.id;

ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS cancelled_by text;  -- 'pawwer' | 'client' | 'system' | NULL

-- ── 2. compute_pawwer_level — FUENTE ÚNICA de las reglas ──────
CREATE OR REPLACE FUNCTION public.compute_pawwer_level(p_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating   numeric;
  v_reviews  int;
  v_accepted int;
  v_cancels  int;
  v_rate     numeric;
  v_active   boolean;
BEGIN
  SELECT rating, reviews_count INTO v_rating, v_reviews
  FROM public.pawwer WHERE id = p_id;
  IF NOT FOUND THEN RETURN 'nuevo'; END IF;

  -- cancel_rate = canceladas por el pawwer / aceptadas
  SELECT COUNT(*) FILTER (WHERE accepted_at IS NOT NULL),
         COUNT(*) FILTER (WHERE cancelled_by = 'pawwer')
  INTO   v_accepted, v_cancels
  FROM   public.booking WHERE pawwer_id = p_id;
  v_rate := CASE WHEN COALESCE(v_accepted, 0) > 0
                 THEN v_cancels::numeric / v_accepted ELSE 0 END;

  -- activo 30d = presencia en la app  O  reserva aceptada/completada en 30 días
  v_active := EXISTS (
      SELECT 1 FROM public.presence pr
      WHERE pr.user_id = p_id AND pr.last_seen_at > now() - INTERVAL '30 days'
    ) OR EXISTS (
      SELECT 1 FROM public.booking b
      WHERE b.pawwer_id = p_id
        AND (b.accepted_at > now() - INTERVAL '30 days'
             OR (b.status_id = 4 AND b.end_date > (now() - INTERVAL '30 days')::date))
    );

  IF COALESCE(v_reviews, 0) >= 15 AND COALESCE(v_rating, 0) >= 4.8
     AND v_rate <= 0.02 AND v_active THEN
    RETURN 'ranger';
  ELSIF COALESCE(v_reviews, 0) >= 5 AND COALESCE(v_rating, 0) >= 4.5
     AND v_rate <= 0.10 THEN
    RETURN 'super';
  ELSE
    RETURN 'nuevo';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_pawwer_level(uuid) TO authenticated;

-- ── 3. recompute (por-pawwer y global) ────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_pawwer_level(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pawwer SET level = public.compute_pawwer_level(p_id) WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.recompute_all_pawwer_levels()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pawwer SET level = public.compute_pawwer_level(id);
$$;
GRANT EXECUTE ON FUNCTION public.recompute_all_pawwer_levels() TO service_role;

-- ── 4. Hook: al cambiar reseñas se recalcula rating + nivel ───
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
  PERFORM public.recompute_pawwer_level(v_pawwer);
  RETURN NULL;
END;
$$;
-- (el trigger trg_refresh_pawwer_rating de la mig 27 sigue apuntando a esta función)

-- ── 5. cancel_booking (pawwer): marca cancelled_by + recalcula ─
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b      public.booking%ROWTYPE;
  v_name   text;
  v_avatar text;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND pawwer_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuidado no encontrado';
  END IF;
  IF v_b.status_id NOT IN (2, 3) THEN
    RAISE EXCEPTION 'Solo puedes cancelar un cuidado confirmado o en curso';
  END IF;

  UPDATE public.availability
  SET   slots_remaining = slots_remaining + 1
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date;

  UPDATE public.booking SET status_id = 5, cancelled_by = 'pawwer' WHERE id = p_booking_id;

  SELECT name, avatar_url INTO v_name, v_avatar
  FROM   public.profile WHERE id = auth.uid();

  INSERT INTO public.notifications
    (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
  VALUES
    (v_b.client_id, 'cuidado',
     'Cuidado cancelado',
     COALESCE(v_name, 'El cuidador') || ' canceló tu cuidado. Te ayudaremos a encontrar otro.',
     p_booking_id, v_name, v_avatar, '/mis-reservas');

  INSERT INTO public.messages (booking_id, sender_id, content, is_system)
  VALUES (p_booking_id, NULL,
          'El cuidador canceló este cuidado. Lamentamos el inconveniente. 😔',
          true);

  -- La cancelación cuenta contra el pawwer → recalcular su nivel.
  PERFORM public.recompute_pawwer_level(auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;

-- ── 6. cancel_booking_client: marca cancelled_by='client' ─────
CREATE OR REPLACE FUNCTION public.cancel_booking_client(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b      public.booking%ROWTYPE;
  v_name   text;
  v_avatar text;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND client_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;
  IF v_b.status_id NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Solo puedes cancelar antes de que inicie el cuidado';
  END IF;

  IF v_b.status_id = 2 AND v_b.pawwer_id IS NOT NULL THEN
    UPDATE public.availability
    SET   slots_remaining = slots_remaining + 1
    WHERE pawwer_id = v_b.pawwer_id
      AND date BETWEEN v_b.start_date AND v_b.end_date;
  END IF;

  -- La cancela el cliente → no penaliza el cancel_rate del pawwer.
  UPDATE public.booking SET status_id = 5, cancelled_by = 'client' WHERE id = p_booking_id;
  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;

  IF v_b.pawwer_id IS NOT NULL THEN
    SELECT name, avatar_url INTO v_name, v_avatar FROM public.profile WHERE id = auth.uid();

    INSERT INTO public.notifications
      (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
    VALUES
      (v_b.pawwer_id, 'cuidado', 'Cuidado cancelado por el cliente',
       COALESCE(v_name, 'El cliente') || ' canceló su reserva.',
       p_booking_id, v_name, v_avatar, '/pawwer/cuidados/' || p_booking_id);

    IF v_b.status_id = 2 THEN
      INSERT INTO public.messages (booking_id, sender_id, content, is_system)
      VALUES (p_booking_id, NULL, 'El cliente canceló este cuidado. 😔', true);
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_booking_client(uuid) TO authenticated;

-- ── 7. create_booking: comisión 20% atada a Ranger ───────────
-- (Idéntica a la vigente de la mig 40; solo cambia el cálculo de v_rate.)
CREATE OR REPLACE FUNCTION public.create_booking(
  p_pawwer_id       uuid,
  p_start_date      date,
  p_end_date        date,
  p_service_type_id int,
  p_dog_ids         uuid[],
  p_notes           text DEFAULT NULL,
  p_hours_count     int  DEFAULT NULL,
  p_transport_legs  int  DEFAULT 0,
  p_address         text DEFAULT NULL,
  p_lat             double precision DEFAULT NULL,
  p_lng             double precision DEFAULT NULL,
  p_neighborhood    text DEFAULT NULL,
  p_start_time      time DEFAULT NULL,
  p_end_time        time DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id     uuid := auth.uid();
  v_price         numeric;
  v_days          int;
  v_cuidado       numeric;
  v_transport_px  numeric;
  v_transport_fee numeric := 0;
  v_provider      text := NULL;
  v_total         numeric;
  v_commission    numeric;
  v_payout        numeric;
  v_booking_id    uuid;
  v_missing       int;
  v_bad_dogs      int;
  v_dog_id        uuid;
  v_lat           double precision;
  v_lng           double precision;
  v_neighborhood  text;
  v_address       text;
  v_rate          numeric;
BEGIN
  IF v_client_id IS NULL THEN
    RETURN json_build_object('error', 'Debes iniciar sesión');
  END IF;
  IF p_transport_legs NOT IN (0,1,2) THEN
    RETURN json_build_object('error', 'Trayectos de transporte inválidos');
  END IF;

  INSERT INTO public.client (id) VALUES (v_client_id) ON CONFLICT DO NOTHING;

  SELECT latitude, longitude, neighborhood, address
  INTO   v_lat, v_lng, v_neighborhood, v_address
  FROM   public.profile WHERE id = v_client_id;
  v_lat          := COALESCE(p_lat, v_lat);
  v_lng          := COALESCE(p_lng, v_lng);
  v_neighborhood := COALESCE(NULLIF(p_neighborhood, ''), v_neighborhood);
  v_address      := COALESCE(NULLIF(p_address, ''), v_address);

  IF p_dog_ids IS NULL OR array_length(p_dog_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Selecciona al menos una mascota');
  END IF;
  SELECT COUNT(*) INTO v_bad_dogs
  FROM   unnest(p_dog_ids) did
  WHERE  NOT EXISTS (SELECT 1 FROM public.dog d WHERE d.id = did AND d.owner_id = v_client_id);
  IF v_bad_dogs > 0 THEN
    RETURN json_build_object('error', 'Una o más mascotas no te pertenecen');
  END IF;

  SELECT price INTO v_price
  FROM public."service_X_Pawwer"
  WHERE id_pawwer = p_pawwer_id AND id_service = p_service_type_id AND is_active = true;
  IF v_price IS NULL THEN
    RETURN json_build_object('error', 'Servicio no disponible para este Pawwer');
  END IF;

  -- Tasa de comisión según el NIVEL del pawwer (Ranger = 20%). Se congela.
  v_rate := CASE WHEN public.compute_pawwer_level(p_pawwer_id) = 'ranger' THEN 0.20 ELSE 0.25 END;

  v_days := (p_end_date - p_start_date) + 1;

  SELECT COUNT(*) INTO v_missing
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(dt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.pawwer_id = p_pawwer_id AND a.date = d.dt::date AND a.slots_remaining > 0
  );
  IF v_missing > 0 THEN
    RETURN json_build_object('error', 'No hay disponibilidad para las fechas seleccionadas');
  END IF;

  IF p_service_type_id = 4 THEN
    v_cuidado := v_price * COALESCE(p_hours_count, 1);
  ELSE
    v_cuidado := v_price * v_days;
  END IF;

  IF p_transport_legs > 0 THEN
    SELECT COALESCE(transport_price, 0) INTO v_transport_px FROM public.pawwer WHERE id = p_pawwer_id;
    v_transport_fee := COALESCE(v_transport_px, 0) * p_transport_legs;
    IF v_transport_fee > 0 THEN v_provider := 'pawwer'; END IF;
  END IF;

  v_total := v_cuidado + v_transport_fee;
  v_commission := ROUND(v_cuidado * v_rate, 0)
                + CASE WHEN v_provider = 'pawwer' THEN ROUND(v_transport_fee * v_rate, 0) ELSE 0 END;
  v_payout := v_total - v_commission;

  INSERT INTO public.booking (
    client_id, pawwer_id, start_date, end_date, start_time, end_time,
    service_type_id, status_id,
    total, commission, commission_rate, pawwer_payout, hours_count, comments,
    client_lat, client_lng, client_neighborhood, client_address,
    transport_legs, transport_fee, transport_provider
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date, p_start_time, p_end_time,
    p_service_type_id, 1,
    v_total, v_commission, v_rate, v_payout, p_hours_count, p_notes,
    v_lat, v_lng, v_neighborhood, v_address,
    p_transport_legs, v_transport_fee, v_provider
  )
  RETURNING id INTO v_booking_id;

  FOREACH v_dog_id IN ARRAY p_dog_ids LOOP
    INSERT INTO public.dog_booking (booking_id, dog_id)
    VALUES (v_booking_id, v_dog_id) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN json_build_object(
    'booking_id', v_booking_id, 'total', v_total,
    'commission', v_commission, 'commission_rate', v_rate,
    'pawwer_payout', v_payout, 'transport_fee', v_transport_fee
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text, time, time) TO authenticated;

-- ── 8. Detalle del nivel para la tarjeta del portal ──────────
CREATE OR REPLACE FUNCTION public.get_pawwer_level_detail()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       uuid := auth.uid();
  v_rating   numeric;
  v_reviews  int;
  v_created  timestamptz;
  v_accepted int;
  v_cancels  int;
  v_rate     numeric;
  v_active   boolean;
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT rating, reviews_count, created_at INTO v_rating, v_reviews, v_created
  FROM public.pawwer WHERE id = v_id;

  SELECT COUNT(*) FILTER (WHERE accepted_at IS NOT NULL),
         COUNT(*) FILTER (WHERE cancelled_by = 'pawwer')
  INTO   v_accepted, v_cancels
  FROM   public.booking WHERE pawwer_id = v_id;
  v_rate := CASE WHEN COALESCE(v_accepted, 0) > 0
                 THEN v_cancels::numeric / v_accepted ELSE 0 END;

  v_active := EXISTS (
      SELECT 1 FROM public.presence pr
      WHERE pr.user_id = v_id AND pr.last_seen_at > now() - INTERVAL '30 days'
    ) OR EXISTS (
      SELECT 1 FROM public.booking b
      WHERE b.pawwer_id = v_id
        AND (b.accepted_at > now() - INTERVAL '30 days'
             OR (b.status_id = 4 AND b.end_date > (now() - INTERVAL '30 days')::date))
    );

  RETURN jsonb_build_object(
    'level',          public.compute_pawwer_level(v_id),
    'rating',         COALESCE(v_rating, 0),
    'reviews_count',  COALESCE(v_reviews, 0),
    'cancel_rate',    ROUND(v_rate, 4),
    'active_last_30d', v_active,
    'is_grace_new',   COALESCE(v_reviews, 0) < 5 AND v_created > now() - INTERVAL '60 days'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pawwer_level_detail() TO authenticated;

-- ── 9. Cron diario (transiciones por tiempo) ─────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pawwi-levels-daily') THEN
    PERFORM cron.unschedule('pawwi-levels-daily');
  END IF;
END $$;
SELECT cron.schedule('pawwi-levels-daily', '0 8 * * *', $$SELECT public.recompute_all_pawwer_levels();$$);

-- ── 10. Backfill inicial de niveles ──────────────────────────
SELECT public.recompute_all_pawwer_levels();
