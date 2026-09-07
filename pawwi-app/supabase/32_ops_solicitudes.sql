-- ============================================================
-- PAWWI — Operaciones de solicitudes: dirección, cupo al aceptar, cancelación
-- Correr en Supabase SQL Editor después de 31_transport_decided.sql
--
-- Resuelve 4 observaciones del portal Pawwer:
--   #1  El booking guarda la DIRECCIÓN exacta del cliente (client_address),
--       capturada en el flujo de reserva. El pawwer la ve y la abre en Maps.
--   #2  Varias solicitudes pueden coexistir para el mismo pawwer/fecha:
--       create_booking ya NO descuenta el cupo (solo verifica que exista).
--   #3  El cupo se bloquea al ACEPTAR (accept_booking descuenta disponibilidad),
--       no al crear la solicitud. Corta el race de doble-aceptación.
--   #4  cancel_booking: el pawwer cancela un cuidado confirmado/en curso →
--       status 5, devuelve el cupo, avisa al cliente. Habilita "Canceladas".
-- ============================================================

-- ── 1. Columna de dirección en booking (#1) ───────────────────
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS client_address text;

-- ── 2. create_booking — dirección + cupo solo-verificado (#1, #2) ──
-- Cambios vs. mig. 29:
--   • Recibe dirección/coords del flujo de reserva (fallback al profile).
--   • Ya NO descuenta slots_remaining: solo verifica que haya cupo.
--     (El descuento se hace al aceptar — ver accept_booking.)
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
BEGIN
  IF v_client_id IS NULL THEN
    RETURN json_build_object('error', 'Debes iniciar sesión');
  END IF;

  IF p_transport_legs NOT IN (0,1,2) THEN
    RETURN json_build_object('error', 'Trayectos de transporte inválidos');
  END IF;

  INSERT INTO public.client (id) VALUES (v_client_id) ON CONFLICT DO NOTHING;

  -- Ubicación: la del flujo de reserva si viene; si no, la del perfil.
  SELECT latitude, longitude, neighborhood, address
  INTO   v_lat, v_lng, v_neighborhood, v_address
  FROM   public.profile WHERE id = v_client_id;

  v_lat          := COALESCE(p_lat, v_lat);
  v_lng          := COALESCE(p_lng, v_lng);
  v_neighborhood := COALESCE(NULLIF(p_neighborhood, ''), v_neighborhood);
  v_address      := COALESCE(NULLIF(p_address, ''), v_address);

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

  -- Disponibilidad: SOLO verificar que exista cupo en todas las fechas.
  -- (No se descuenta aquí — varias solicitudes pueden coexistir; el cupo
  --  se bloquea cuando el pawwer acepta.)
  SELECT COUNT(*) INTO v_missing
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(dt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.pawwer_id = p_pawwer_id AND a.date = d.dt::date AND a.slots_remaining > 0
  );
  IF v_missing > 0 THEN
    RETURN json_build_object('error', 'No hay disponibilidad para las fechas seleccionadas');
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

  v_commission := ROUND(v_cuidado * 0.25, 0)
                + CASE WHEN v_provider = 'pawwer' THEN ROUND(v_transport_fee * 0.25, 0) ELSE 0 END;
  v_payout := v_total - v_commission;

  INSERT INTO public.booking (
    client_id, pawwer_id, start_date, end_date,
    service_type_id, status_id,
    total, commission, pawwer_payout, hours_count, comments,
    client_lat, client_lng, client_neighborhood, client_address,
    transport_legs, transport_fee, transport_provider
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date,
    p_service_type_id, 1,
    v_total, v_commission, v_payout, p_hours_count, p_notes,
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
    'pawwer_payout', v_payout,
    'transport_fee', v_transport_fee
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text) TO authenticated;
-- Limpia la firma vieja (8 args) para evitar ambigüedad de overload
DROP FUNCTION IF EXISTS public.create_booking(uuid, date, date, int, uuid[], text, int, int);

-- ── 3. accept_booking — bloquea la agenda al aceptar (#3) ─────
-- Conserva el mensaje de sistema (mig. 30) y descuenta el cupo de
-- disponibilidad de forma atómica. Si otro cuidado ganó el cupo, aborta.
CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b       public.booking%ROWTYPE;
  v_days    int;
  v_updated int;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no disponible o ya fue tomada';
  END IF;

  -- Acceso: fase 1 (pawwer directo) o candidato fase 2/3
  IF v_b.pawwer_id IS DISTINCT FROM auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_candidates
      WHERE booking_id = p_booking_id AND pawwer_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a esta reserva';
    END IF;
  END IF;

  -- Bloquear la agenda: descontar cupo al aceptar (antes se hacía al crear).
  v_days := (v_b.end_date - v_b.start_date) + 1;

  PERFORM 1 FROM public.availability
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
  FOR UPDATE;

  UPDATE public.availability
  SET   slots_remaining = slots_remaining - 1
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
    AND slots_remaining > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated < v_days THEN
    RAISE EXCEPTION 'Ya no tienes cupo para estas fechas';
  END IF;

  UPDATE public.booking
  SET status_id = 2,
      pawwer_id = auth.uid()
  WHERE id = p_booking_id;

  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;

  -- Mensaje predeterminado que abre el chat para ambos
  INSERT INTO public.messages (booking_id, sender_id, content, is_system)
  VALUES (p_booking_id, NULL,
          '¡Reserva confirmada! Coordinen aquí los detalles del cuidado. 🐾',
          true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;

-- ── 4. decline_solicitud — sin devolución de cupo (#2/#3) ─────
-- Como create_booking ya no descuenta al crear, declinar en fase 1 ya no
-- devuelve slots (no había nada descontado). El resto igual que mig. 25.
CREATE OR REPLACE FUNCTION public.decline_solicitud(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.booking%ROWTYPE;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no disponible';
  END IF;

  -- Fase 1: el pawwer elegido directamente declina → escalar a fase 2
  IF v_b.search_phase = 1 AND v_b.pawwer_id = auth.uid() THEN
    UPDATE public.booking
    SET search_phase     = 2,
        phase_expires_at = now() + INTERVAL '6 hours'
    WHERE id = p_booking_id;

    -- Candidatos fase 2 (find_escalation_candidates aún ve el pawwer_id original)
    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT p_booking_id, cand.pawwer_id, 2
    FROM   public.find_escalation_candidates(p_booking_id, 2) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;

    -- Soltar al pawwer original para que ya no le aparezca
    UPDATE public.booking SET pawwer_id = NULL WHERE id = p_booking_id;

    RETURN;
  END IF;

  -- Fases 2/3: eliminar solo esta candidatura
  IF NOT EXISTS (
    SELECT 1 FROM public.booking_candidates
    WHERE booking_id = p_booking_id AND pawwer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres candidato para esta reserva';
  END IF;

  DELETE FROM public.booking_candidates
  WHERE booking_id = p_booking_id AND pawwer_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_solicitud(uuid) TO authenticated;

-- ── 5. cancel_booking — el pawwer cancela un cuidado (#4) ─────
-- Solo el pawwer asignado, sobre un cuidado confirmado (2) o en curso (3).
-- Libera el cupo (que accept_booking había descontado), avisa al cliente
-- (notificación + mensaje de sistema) y deja el registro en 'cancelled' (5),
-- conservando pawwer_id para que aparezca en el histórico "Canceladas".
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

  -- Devolver el cupo bloqueado al aceptar
  UPDATE public.availability
  SET   slots_remaining = slots_remaining + 1
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date;

  UPDATE public.booking SET status_id = 5 WHERE id = p_booking_id;

  -- Aviso al cliente: notificación + mensaje de sistema en el chat
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;

-- ── 6. get_pawwer_bookings — devuelve client_address (#1) ─────
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
      'client_neighborhood', b.client_neighborhood, 'client_address', b.client_address,
      'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
      'transport_provider', b.transport_provider, 'transport_decided', b.transport_decided,
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

-- ── 7. get_pawwer_booking_detail — devuelve client_address (#1) ──
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
    'client_neighborhood', b.client_neighborhood, 'client_address', b.client_address,
    'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
    'transport_provider', b.transport_provider, 'transport_decided', b.transport_decided,
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
