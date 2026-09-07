-- ============================================================
-- PAWWI — A1: Comisión por rating (20% para pawwers élite)
-- Correr en Supabase SQL Editor después de 35_global_advance_stats.sql
--
-- La UI promete al pawwer bajar la comisión del 25% al 20% con rating ≥ 4.8
-- y ≥ 15 reseñas, pero el backend hardcodeaba 0.25. Ahora create_booking
-- calcula la tasa real y la CONGELA en el booking (commission_rate), y
-- set_transport_provider reusa esa misma tasa (consistencia si el rating
-- cambia entre la reserva y la decisión de transporte).
--
-- Umbrales espejo del front (InicioClient): 4.8 y 15.
-- ============================================================

-- ── Congelar la tasa de comisión usada en cada booking ────────
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 0.25;

-- ── create_booking — tasa según rating del pawwer ─────────────
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
  p_neighborhood    text DEFAULT NULL
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
  v_rating        numeric;
  v_reviews       int;
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

  -- Tasa de comisión según el rating del pawwer (congelada en el booking)
  SELECT rating, reviews_count INTO v_rating, v_reviews FROM public.pawwer WHERE id = p_pawwer_id;
  v_rate := CASE
    WHEN COALESCE(v_rating, 0) >= 4.8 AND COALESCE(v_reviews, 0) >= 15 THEN 0.20
    ELSE 0.25
  END;

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
    IF v_transport_fee > 0 THEN
      v_provider := 'pawwer';
    END IF;
  END IF;

  v_total := v_cuidado + v_transport_fee;

  v_commission := ROUND(v_cuidado * v_rate, 0)
                + CASE WHEN v_provider = 'pawwer' THEN ROUND(v_transport_fee * v_rate, 0) ELSE 0 END;
  v_payout := v_total - v_commission;

  INSERT INTO public.booking (
    client_id, pawwer_id, start_date, end_date,
    service_type_id, status_id,
    total, commission, commission_rate, pawwer_payout, hours_count, comments,
    client_lat, client_lng, client_neighborhood, client_address,
    transport_legs, transport_fee, transport_provider
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date,
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
    'booking_id',    v_booking_id,
    'total',         v_total,
    'commission',    v_commission,
    'commission_rate', v_rate,
    'pawwer_payout', v_payout,
    'transport_fee', v_transport_fee
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text) TO authenticated;

-- ── set_transport_provider — reusa la tasa congelada del booking ──
CREATE OR REPLACE FUNCTION public.set_transport_provider(
  p_booking_id uuid,
  p_provider   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b          public.booking%ROWTYPE;
  v_cuidado    numeric;
  v_commission numeric;
BEGIN
  IF p_provider NOT IN ('pawwer','pawwi') THEN
    RAISE EXCEPTION 'Proveedor inválido';
  END IF;

  SELECT * INTO v_b FROM public.booking
  WHERE id = p_booking_id AND pawwer_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;
  IF v_b.status_id NOT IN (2,3) THEN
    RAISE EXCEPTION 'Solo puedes elegir el transporte en un cuidado confirmado o en curso';
  END IF;
  IF v_b.transport_fee <= 0 THEN
    RAISE EXCEPTION 'Este cuidado no incluye transporte';
  END IF;
  IF v_b.transport_decided THEN
    RAISE EXCEPTION 'La decisión de transporte ya fue tomada';
  END IF;

  v_cuidado := v_b.total - v_b.transport_fee;
  -- Misma tasa con la que se creó el booking (élite = 20%).
  v_commission := ROUND(v_cuidado * v_b.commission_rate, 0)
                + CASE WHEN p_provider = 'pawwer'
                       THEN ROUND(v_b.transport_fee * v_b.commission_rate, 0)
                       ELSE v_b.transport_fee END;  -- pawwi: 100% del transporte

  UPDATE public.booking
  SET transport_provider = p_provider,
      transport_decided  = true,
      commission         = v_commission,
      pawwer_payout      = v_b.total - v_commission
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_transport_provider(uuid, text) TO authenticated;
