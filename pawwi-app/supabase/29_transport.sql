-- ============================================================
-- PAWWI — Transporte del peludito
-- Correr en Supabase SQL Editor después de 28_schema_cleanup.sql
--
-- Modelo:
--   • El pawwer fija transport_price por trayecto (> $15.000) en su perfil.
--   • El cliente elige trayectos al reservar: 0=ninguno, 1=ida, 2=ida y vuelta.
--     transport_fee = legs × transport_price  (snapshot en el booking).
--   • El cliente SIEMPRE paga total = cuidado + transport_fee.
--   • Tras aceptar, el pawwer decide quién hace el transporte:
--       - 'pawwer' (default): lo hace él → recibe 75% del transporte (Pawwi 25%).
--       - 'pawwi':            lo hace Pawwi → Pawwi se queda con el 100%.
--   • El cuidado siempre se reparte 75/25.
-- ============================================================

-- ── 1. Columnas de transporte en booking ──────────────────────
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS transport_legs     smallint NOT NULL DEFAULT 0 CHECK (transport_legs IN (0,1,2)),
  ADD COLUMN IF NOT EXISTS transport_fee      numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_provider text     CHECK (transport_provider IN ('pawwer','pawwi'));

-- ── 2. create_booking — calcula y persiste el transporte ──────
-- (Mantiene: validación de dueño de perros, race de overbooking,
--  copia de ubicación del cliente, grants. Default provider = 'pawwer'.)
CREATE OR REPLACE FUNCTION public.create_booking(
  p_pawwer_id       uuid,
  p_start_date      date,
  p_end_date        date,
  p_service_type_id int,
  p_dog_ids         uuid[],
  p_notes           text DEFAULT NULL,
  p_hours_count     int  DEFAULT NULL,
  p_transport_legs  int  DEFAULT 0
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
  v_updated       int;
  v_dog_id        uuid;
  v_lat           double precision;
  v_lng           double precision;
  v_neighborhood  text;
BEGIN
  IF v_client_id IS NULL THEN
    RETURN json_build_object('error', 'Debes iniciar sesión');
  END IF;

  IF p_transport_legs NOT IN (0,1,2) THEN
    RETURN json_build_object('error', 'Trayectos de transporte inválidos');
  END IF;

  INSERT INTO public.client (id) VALUES (v_client_id) ON CONFLICT DO NOTHING;

  SELECT latitude, longitude, neighborhood
  INTO   v_lat, v_lng, v_neighborhood
  FROM   public.profile WHERE id = v_client_id;

  -- Validar dueño de los perros
  IF p_dog_ids IS NULL OR array_length(p_dog_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Selecciona al menos una mascota');
  END IF;
  SELECT COUNT(*) INTO v_bad_dogs
  FROM   unnest(p_dog_ids) did
  WHERE  NOT EXISTS (SELECT 1 FROM public.dog d WHERE d.id = did AND d.owner_id = v_client_id);
  IF v_bad_dogs > 0 THEN
    RETURN json_build_object('error', 'Una o más mascotas no te pertenecen');
  END IF;

  -- Precio del servicio
  SELECT price INTO v_price
  FROM public."service_X_Pawwer"
  WHERE id_pawwer = p_pawwer_id AND id_service = p_service_type_id AND is_active = true;
  IF v_price IS NULL THEN
    RETURN json_build_object('error', 'Servicio no disponible para este Pawwer');
  END IF;

  v_days := (p_end_date - p_start_date) + 1;

  -- Disponibilidad
  SELECT COUNT(*) INTO v_missing
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(dt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.pawwer_id = p_pawwer_id AND a.date = d.dt::date AND a.slots_remaining > 0
  );
  IF v_missing > 0 THEN
    RETURN json_build_object('error', 'No hay disponibilidad para las fechas seleccionadas');
  END IF;

  PERFORM 1 FROM public.availability
  WHERE pawwer_id = p_pawwer_id AND date BETWEEN p_start_date AND p_end_date
  FOR UPDATE;

  UPDATE public.availability
  SET slots_remaining = slots_remaining - 1
  WHERE pawwer_id = p_pawwer_id AND date BETWEEN p_start_date AND p_end_date AND slots_remaining > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated < v_days THEN
    RAISE EXCEPTION 'No hay disponibilidad para las fechas seleccionadas';
  END IF;

  -- Cuidado
  IF p_service_type_id = 4 THEN
    v_cuidado := v_price * COALESCE(p_hours_count, 1);
  ELSE
    v_cuidado := v_price * v_days;
  END IF;

  -- Transporte (snapshot del precio del pawwer × trayectos)
  IF p_transport_legs > 0 THEN
    SELECT COALESCE(transport_price, 0) INTO v_transport_px FROM public.pawwer WHERE id = p_pawwer_id;
    v_transport_fee := COALESCE(v_transport_px, 0) * p_transport_legs;
    IF v_transport_fee > 0 THEN
      v_provider := 'pawwer';  -- default: lo toma el pawwer (puede cambiarlo luego)
    END IF;
  END IF;

  v_total := v_cuidado + v_transport_fee;

  -- Comisión: cuidado 25% + (provider pawwer ? transporte 25% : —). Default pawwer.
  v_commission := ROUND(v_cuidado * 0.25, 0)
                + CASE WHEN v_provider = 'pawwer' THEN ROUND(v_transport_fee * 0.25, 0) ELSE 0 END;
  v_payout := v_total - v_commission;

  INSERT INTO public.booking (
    client_id, pawwer_id, start_date, end_date,
    service_type_id, status_id,
    total, commission, pawwer_payout, hours_count, comments,
    client_lat, client_lng, client_neighborhood,
    transport_legs, transport_fee, transport_provider
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date,
    p_service_type_id, 1,
    v_total, v_commission, v_payout, p_hours_count, p_notes,
    v_lat, v_lng, v_neighborhood,
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
    'pawwer_payout', v_payout,
    'transport_fee', v_transport_fee
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int) TO authenticated;
-- Limpia la firma vieja (7 args) para evitar ambigüedad de overload
DROP FUNCTION IF EXISTS public.create_booking(uuid, date, date, int, uuid[], text, int);

-- ── 3. set_transport_provider — el pawwer decide tras aceptar ─
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
  v_b        public.booking%ROWTYPE;
  v_cuidado  numeric;
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

  v_cuidado := v_b.total - v_b.transport_fee;
  v_commission := ROUND(v_cuidado * 0.25, 0)
                + CASE WHEN p_provider = 'pawwer'
                       THEN ROUND(v_b.transport_fee * 0.25, 0)
                       ELSE v_b.transport_fee END;  -- pawwi: comisión = 100% del transporte

  UPDATE public.booking
  SET transport_provider = p_provider,
      commission         = v_commission,
      pawwer_payout      = v_b.total - v_commission
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_transport_provider(uuid, text) TO authenticated;

-- ── 4. get_pawwer_bookings — incluye transporte ───────────────
CREATE OR REPLACE FUNCTION public.get_pawwer_bookings(p_status_ids int[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id, 'start_date', b.start_date, 'end_date', b.end_date,
      'start_time', b.start_time, 'end_time', b.end_time,
      'total', b.total, 'pawwer_payout', b.pawwer_payout,
      'status_id', b.status_id, 'search_phase', b.search_phase,
      'phase_expires_at', b.phase_expires_at, 'created_at', b.created_at,
      'client_lat', b.client_lat, 'client_lng', b.client_lng,
      'client_neighborhood', b.client_neighborhood,
      'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
      'transport_provider', b.transport_provider,
      'service_type', st.name,
      'client', jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url),
      'dogs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', d.name, 'breed', d.breed, 'photo_url', d.photo_url, 'weight_kg', d.weight_kg))
        FROM public.dog_booking db JOIN public.dog d ON d.id = db.dog_id
        WHERE db.booking_id = b.id), '[]'::jsonb)
    ) ORDER BY b.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p       ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.status_id = ANY(p_status_ids)
    AND (b.pawwer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.booking_candidates bc
                    WHERE bc.booking_id = b.id AND bc.pawwer_id = auth.uid()));
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pawwer_bookings(int[]) TO authenticated;

-- ── 5. get_pawwer_booking_detail — incluye transporte ─────────
CREATE OR REPLACE FUNCTION public.get_pawwer_booking_detail(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', b.id, 'start_date', b.start_date, 'end_date', b.end_date,
    'start_time', b.start_time, 'end_time', b.end_time,
    'total', b.total, 'pawwer_payout', b.pawwer_payout,
    'status_id', b.status_id, 'search_phase', b.search_phase,
    'phase_expires_at', b.phase_expires_at, 'created_at', b.created_at,
    'comments', b.comments,
    'client_lat', b.client_lat, 'client_lng', b.client_lng,
    'client_neighborhood', b.client_neighborhood,
    'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
    'transport_provider', b.transport_provider,
    'service_type', st.name,
    'client', jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url),
    'dogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', d.name, 'breed', d.breed, 'photo_url', d.photo_url,
        'age', d.age, 'notes', d.notes, 'weight_kg', d.weight_kg, 'sex', d.sex))
      FROM public.dog_booking db JOIN public.dog d ON d.id = db.dog_id
      WHERE db.booking_id = b.id), '[]'::jsonb),
    'review', (
      SELECT jsonb_build_object('rating', r.rating, 'comment', r.comment)
      FROM public.reviews r WHERE r.booking_id = b.id LIMIT 1)
  )
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p       ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.id = p_booking_id
    AND (b.pawwer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.booking_candidates bc
                    WHERE bc.booking_id = b.id AND bc.pawwer_id = auth.uid()));
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pawwer_booking_detail(uuid) TO authenticated;
