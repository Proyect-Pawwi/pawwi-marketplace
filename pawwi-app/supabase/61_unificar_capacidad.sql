-- ============================================================
-- PAWWI — S1 · Unificar las dos capacidades
-- Correr en Supabase SQL Editor después de 60_desmontar_transporte_pawwi.sql
--
-- EL PROBLEMA: convivían dos sistemas de capacidad que nunca se hablaron.
--
--   service_X_Pawwer.max_animals  → «acepta hasta N perros». Se le MOSTRABA
--                                    al cliente y no se validaba en ninguna
--                                    parte. Decorativo.
--   availability.slots_remaining  → lo que accept_booking descontaba de
--                                    verdad: 1 por RESERVA, sin importar
--                                    cuántos perros trajera.
--
-- Con capacidad 1 nadie lo nota. Con capacidad 4 es sobreventa garantizada:
-- cuatro reservas de tres perros cada una entraban como «4 cupos» y dejaban
-- doce perros en una casa que declaró aceptar cuatro.
--
-- LA UNIFICACIÓN: el cupo se mide en PERROS, no en reservas.
--
--   • slots_remaining pasa a contar perros que aún caben ese día.
--   • create_booking exige slots_remaining >= nº de perros en CADA día
--     del rango, y hace cumplir max_animals, que deja de ser decorativo.
--   • accept_booking descuenta el nº de perros; las cancelaciones lo devuelven.
--   • update_service_rules pierde el tope de 10 (decisión 07: la capacidad
--     la decide el Pawwer, sin tope de Pawwi).
--
-- ⚠️ RECONCILIACIÓN DE DATOS: el número guardado en slots_remaining estaba en
-- unidades de «reservas» y no se puede convertir a «perros» sin conocer la
-- capacidad original del día, que nunca se guardó. Se recalcula desde la única
-- fuente que sí es declarativa y sí es del Pawwer: su propio max_animals.
-- Solo se tocan fechas de HOY en adelante; el pasado es registro histórico.
-- ============================================================

BEGIN;

COMMENT ON COLUMN public.availability.slots_remaining IS
  'PERROS que el Pawwer todavía acepta ese día (no reservas). Lo descuenta '
  'accept_booking según el nº de perros de la reserva y lo devuelven las '
  'cancelaciones. Unificado con service_X_Pawwer.max_animals en S1.';

-- ── 1. Sin tope de Pawwi a la capacidad (decisión 07) ─────────
-- El tope de 10 lo ponía Pawwi, no el Pawwer. La decisión 07 lo elimina:
-- Pawwi expone capacidad y ocupación, y el mercado hace el resto. Un Pawwer
-- que acepta ocho perros ES una guardería pequeña — la decisión no lo
-- prohíbe, lo revela, y el cliente lo ve antes de reservar.
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
  IF p_max_animals < 1 THEN RAISE EXCEPTION 'Cantidad máxima inválida'; END IF;
  IF p_max_size NOT IN (1, 2, 3) THEN RAISE EXCEPTION 'Tamaño máximo inválido'; END IF;
  UPDATE public."service_X_Pawwer"
  SET   max_animals = p_max_animals, max_size = p_max_size
  WHERE id_pawwer = auth.uid() AND id_service = p_id_service;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_service_rules(int, int, int) TO authenticated;

-- ── 2. create_booking — valida perros contra tope y cupo ──────
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
  v_n_dogs        int;
  v_max_animals   int;
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
  v_n_dogs := array_length(p_dog_ids, 1);

  SELECT price, max_animals INTO v_price, v_max_animals
  FROM public."service_X_Pawwer"
  WHERE id_pawwer = p_pawwer_id AND id_service = p_service_type_id AND is_active = true;
  IF v_price IS NULL THEN
    RETURN json_build_object('error', 'Servicio no disponible para este Pawwer');
  END IF;

  -- El tope que el Pawwer declaró para ESTE servicio deja de ser decorativo.
  IF v_n_dogs > COALESCE(v_max_animals, 1) THEN
    RETURN json_build_object(
      'error', format('Este Pawwer acepta hasta %s %s a la vez en este servicio',
                      COALESCE(v_max_animals, 1),
                      CASE WHEN COALESCE(v_max_animals, 1) = 1 THEN 'perro' ELSE 'perros' END));
  END IF;

  -- Tasa de comisión según el NIVEL del pawwer (Ranger = 20%). Se congela.
  v_rate := CASE WHEN public.compute_pawwer_level(p_pawwer_id) = 'ranger' THEN 0.20 ELSE 0.25 END;

  v_days := (p_end_date - p_start_date) + 1;

  SELECT COUNT(*) INTO v_missing
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(dt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.pawwer_id = p_pawwer_id AND a.date = d.dt::date AND a.slots_remaining >= v_n_dogs
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

-- ── 3. accept_booking — descuenta perros, no reservas ────────
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
  v_n_dogs  int;
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

  -- El cupo se mide en PERROS, no en reservas: una reserva de 3 perros
  -- consume 3 lugares del día. Antes descontaba 1 por reserva, que con
  -- capacidad 1 nadie notaba y con capacidad 4 era sobreventa garantizada.
  SELECT COUNT(*) INTO v_n_dogs
  FROM   public.dog_booking WHERE booking_id = p_booking_id;
  IF v_n_dogs < 1 THEN
    RAISE EXCEPTION 'La reserva no tiene mascotas asociadas';
  END IF;

  PERFORM 1 FROM public.availability
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
  FOR UPDATE;

  UPDATE public.availability
  SET   slots_remaining = slots_remaining - v_n_dogs
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
    AND slots_remaining >= v_n_dogs;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated < v_days THEN
    RAISE EXCEPTION 'Ya no tienes cupo para estas fechas';
  END IF;

  UPDATE public.booking
  SET status_id   = 2,
      pawwer_id   = auth.uid(),
      accepted_at = now()
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

-- ── 4. cancel_booking — devuelve perros ──────────────────────
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
  v_n_dogs int;
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

  -- Devolver tantos lugares como perros consumió la reserva.
  SELECT COUNT(*) INTO v_n_dogs
  FROM   public.dog_booking WHERE booking_id = p_booking_id;

  UPDATE public.availability
  SET   slots_remaining = slots_remaining + GREATEST(v_n_dogs, 1)
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

-- ── 5. cancel_booking_client — devuelve perros ───────────────
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
  v_n_dogs int;
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
    SELECT COUNT(*) INTO v_n_dogs
    FROM   public.dog_booking WHERE booking_id = p_booking_id;

    UPDATE public.availability
    SET   slots_remaining = slots_remaining + GREATEST(v_n_dogs, 1)
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

-- ── 6. Reconciliar la disponibilidad futura ───────────────────
-- El número guardado estaba en unidades de «reservas». Se recalcula así:
--
--   capacidad del día = el mayor max_animals entre los servicios ACTIVOS del
--                       Pawwer — lo que él mismo declaró que le cabe a la vez
--   ocupación del día = perros ya comprometidos en reservas confirmadas (2)
--                       o en curso (3) que cubren esa fecha
--
-- Solo fechas de hoy en adelante: el pasado es registro, no agenda.
UPDATE public.availability a
SET slots_remaining = GREATEST(0, cap.max_cap - COALESCE((
      SELECT COUNT(db.dog_id)
      FROM   public.booking b
      JOIN   public.dog_booking db ON db.booking_id = b.id
      WHERE  b.pawwer_id = a.pawwer_id
        AND  b.status_id IN (2, 3)
        AND  a.date BETWEEN b.start_date AND b.end_date
    ), 0))
FROM (
  SELECT id_pawwer, MAX(max_animals) AS max_cap
  FROM   public."service_X_Pawwer"
  WHERE  is_active = true
  GROUP  BY id_pawwer
) cap
WHERE a.pawwer_id = cap.id_pawwer
  AND a.date >= CURRENT_DATE;

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
-- 1) Ningún día futuro promete más perros de los que el Pawwer declaró:
--
--   select count(*) as dias_incoherentes
--   from public.availability a
--   join (select id_pawwer, max(max_animals) mc
--         from public."service_X_Pawwer" where is_active = true
--         group by id_pawwer) c on c.id_pawwer = a.pawwer_id
--   where a.date >= current_date and a.slots_remaining > c.mc;
--   -- esperado: 0
--
-- 2) El tope de 10 ya no existe:
--
--   select pg_get_functiondef(oid) like '%> 10%' as conserva_el_tope
--   from pg_proc where proname = 'update_service_rules';
--   -- esperado: false
