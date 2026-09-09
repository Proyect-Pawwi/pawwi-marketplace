-- ============================================================
-- PAWWI — S1 · Dos etapas en vez de tres fases
-- Correr en Supabase SQL Editor después de 63_ocupacion_y_comportamiento.sql
--
-- EL MOTOR DE ESCALACIÓN SE QUEDA. En una versión anterior de docs/06 se
-- propuso retirarlo alegando que empujar solicitudes a Pawwers que no las
-- pidieron creaba un indicio de subordinación laboral. **Ese análisis era
-- erróneo.** Uber, DiDi, Yango y Rappi hacen exactamente eso y es el patrón
-- defendible: lo que genera riesgo es OBLIGAR a aceptar o CASTIGAR el rechazo.
-- decline_solicitud ya existía — el derecho de rechazo estuvo ahí siempre.
--
-- QUÉ CAMBIA:
--
--   1. Tres fases → dos etapas.
--        Etapa 1 · 1 h · exclusiva del Pawwer que el cliente eligió
--        Etapa 2 · 6 h · bolsa general
--      Antes eran 1 h + 6 h + 6 h = 13 horas antes de sin_cuidador, que para un
--      cuidado de mañana no le sirve a nadie. La fase intermedia («±20% de
--      precio») no aportaba nada: la bolsa ya es toda la ciudad.
--
--   2. Se quita el PISO de precio del filtro de candidatos.
--      Excluía a los Pawwers MÁS BARATOS — Pawwi arbitrando el mercado, justo
--      lo que prohíbe la decisión 07. El techo se queda: nadie cobra más de lo
--      que el cliente aceptó. Quien cobre menos y la tome gana MÁS que su
--      tarifa de lista, lo que convierte la bolsa en un incentivo real.
--
--   3. Los cupos se miden en PERROS también aquí.
--      La migración 61 cambió el significado de slots_remaining y esta función
--      se quedó atrás: proponía candidatos con 1 cupo para reservas de 2
--      perros, y accept_booking los rechazaba después.
--
--   4. booking.allow_pool — el consentimiento del cliente.
--      El cliente no compró «un cuidado»: eligió ESA casa después de ver sus
--      fotos y sus reseñas. Pasar su reserva a otro sin permiso rompe lo único
--      que Pawwi vende. Se le pregunta al reservar, una sola vez.
-- ============================================================

BEGIN;

-- ── 1. El consentimiento ──────────────────────────────────────
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS allow_pool boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.booking.allow_pool IS
  'El cliente autorizó que, si el Pawwer elegido declina o se le vence el '
  'plazo, la reserva pase a la bolsa general. Si es false, muere como '
  'sin_cuidador (6) y el cliente vuelve a elegir. DEFAULT true conserva el '
  'comportamiento previo en las reservas históricas.';

-- ── 2. find_escalation_candidates — techo sin piso, cupos en perros ─
CREATE OR REPLACE FUNCTION public.find_escalation_candidates(
  p_booking_id uuid,
  -- p_phase ya no se usa en el cuerpo: con una sola etapa de bolsa no hay
  -- criterios distintos por fase. Se conserva en la firma para no romper la
  -- llamada del cron ni obligar a un DROP; el valor que se pasa es siempre 2.
  p_phase      int
)
RETURNS TABLE(pawwer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_service_type_id int;
  v_original_pawwer uuid;
  v_pawwer_payout   numeric;
  v_start_date      date;
  v_end_date        date;
  v_days            int;
  v_max_rate        numeric;
  v_n_dogs          int;
BEGIN
  SELECT b.service_type_id, b.pawwer_id, b.pawwer_payout,
         b.start_date, b.end_date
  INTO   v_service_type_id, v_original_pawwer, v_pawwer_payout,
         v_start_date, v_end_date
  FROM   public.booking b
  WHERE  b.id = p_booking_id;

  -- +1 porque el rango es INCLUSIVO en los dos extremos: un cuidado del 14 al
  -- 16 son 3 días, no 2. Sin el +1 la tarifa diaria salía inflada y el techo de
  -- precio dejaba entrar candidatos más caros de lo que el cliente aceptó.
  v_days     := GREATEST(1, v_end_date - v_start_date + 1);
  SELECT COUNT(*) INTO v_n_dogs
  FROM   public.dog_booking WHERE booking_id = p_booking_id;
  v_max_rate := (v_pawwer_payout / v_days) * 1.20;

  RETURN QUERY
  SELECT DISTINCT sxp.id_pawwer
  FROM   public."service_X_Pawwer" sxp
  JOIN   public.pawwer pw ON pw.id = sxp.id_pawwer
  WHERE  sxp.id_service = v_service_type_id
    AND  sxp.is_active  = true
    AND  pw.status      = 'approved'
    AND  pw.accepting_bookings = true          -- ← no pausados
    AND  pw.deactivated_at IS NULL             -- ← no desactivados
    AND  sxp.id_pawwer != COALESCE(v_original_pawwer, '00000000-0000-0000-0000-000000000000'::uuid)
    -- Solo TECHO, sin piso. El piso excluía a los Pawwers MÁS BARATOS, que es
    -- Pawwi arbitrando el mercado — justo lo que prohíbe la decisión 07. Quien
    -- cobre menos puede tomarla y gana MÁS que su tarifa de lista; lo único que
    -- Pawwi garantiza es que nadie cobre más de lo que el cliente ya aceptó.
    AND  sxp.price <= v_max_rate
    AND  NOT EXISTS (
           SELECT 1
           FROM   (
             SELECT (v_start_date + gs.i)::date AS d
             FROM   generate_series(0, v_end_date - v_start_date) AS gs(i)
           ) dates
           WHERE  NOT EXISTS (
             SELECT 1
             FROM   public.availability a
             WHERE  a.pawwer_id       = sxp.id_pawwer
               AND  a.date            = dates.d
               -- Cupos en PERROS (unificación de la mig 61). Antes pedía > 0 y
               -- proponía candidatos con 1 cupo para reservas de 2 perros, que
               -- accept_booking rechazaba después.
               AND  a.slots_remaining >= v_n_dogs
           )
         )
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.booking_candidates bc
           WHERE  bc.booking_id = p_booking_id
             AND  bc.pawwer_id  = sxp.id_pawwer
         );
END;
$$;

-- ── 3. run_booking_cron — dos etapas ─────────────────────────
CREATE OR REPLACE FUNCTION public.run_booking_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        uuid;
  v_escalated int := 0;
  v_expired   int := 0;
  v_stage2_expired int := 0;
BEGIN
  -- ── 1. Etapa 1 vencida ─────────────────────────────────────
  -- Con consentimiento del cliente pasa a la bolsa general; sin él muere como
  -- sin_cuidador. El cliente eligió ESA casa: no se le sustituye sin permiso.
  FOR v_id IN
    SELECT id FROM public.booking
    WHERE status_id = 1 AND search_phase = 1
      AND phase_expires_at IS NOT NULL AND phase_expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    IF NOT (SELECT allow_pool FROM public.booking WHERE id = v_id) THEN
      UPDATE public.booking
      SET    status_id = 6, phase_expires_at = NULL
      WHERE  id = v_id;
      v_expired := v_expired + 1;
      CONTINUE;
    END IF;

    UPDATE public.booking
    SET search_phase = 2, phase_expires_at = now() + INTERVAL '6 hours'
    WHERE id = v_id;

    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT v_id, cand.pawwer_id, 2
    FROM   public.find_escalation_candidates(v_id, 2) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;

    -- soltar al pawwer original (deja de aparecerle / no puede aceptar vencida)
    UPDATE public.booking SET pawwer_id = NULL WHERE id = v_id;
    v_escalated := v_escalated + 1;
  END LOOP;

  -- ── 2. Etapa 2 vencida → sin_cuidador (6) ──────────────────
  -- Antes había una tercera fase «ciudad» con otras 6 horas: 13 en total, que
  -- para un cuidado de mañana no le sirve a nadie. La bolsa ya es toda la
  -- ciudad, así que la fase intermedia no aportaba nada salvo espera.
  UPDATE public.booking
  SET    status_id = 6, phase_expires_at = NULL
  WHERE  status_id = 1 AND search_phase = 2
    AND  phase_expires_at IS NOT NULL AND phase_expires_at <= now();
  GET DIAGNOSTICS v_stage2_expired = ROW_COUNT;
  v_expired := v_expired + v_stage2_expired;

  -- ── 4. Avance de estados por tiempo (global) ───────────────
  PERFORM public.advance_all_booking_statuses();

  RETURN jsonb_build_object('escalated', v_escalated, 'expired', v_expired, 'ran_at', now());
END;
$$;

-- ── 4. decline_solicitud — respeta allow_pool ────────────────
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

  -- Etapa 1: el pawwer elegido declina.
  -- Si el cliente NO consintió la bolsa, la reserva muere aquí como
  -- sin_cuidador y él vuelve a elegir. Rechazar es su derecho; sustituirle la
  -- casa sin permiso no es una consecuencia aceptable de ese derecho.
  IF v_b.search_phase = 1 AND v_b.pawwer_id = auth.uid() THEN
    IF NOT v_b.allow_pool THEN
      UPDATE public.booking
      SET    status_id = 6, pawwer_id = NULL, phase_expires_at = NULL
      WHERE  id = p_booking_id;
      RETURN;
    END IF;

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

  -- Etapa 2 (bolsa): eliminar solo esta candidatura
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

-- ── 5. create_booking — recibe el consentimiento ──────────────
-- ⚠️ La firma gana un parámetro, así que CREATE OR REPLACE NO reemplaza: crea
-- una SOBRECARGA. Hay que eliminar la de 14 parámetros o PostgREST podría
-- resolver la llamada contra la versión vieja, que ignora allow_pool.
DROP FUNCTION IF EXISTS public.create_booking(
  uuid, date, date, int, uuid[], text, int, int, text,
  double precision, double precision, text, time, time);

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
  p_end_time        time DEFAULT NULL,
  -- Al final de la firma y con DEFAULT para no romper llamadas existentes.
  p_allow_pool      boolean DEFAULT true
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
    transport_legs, transport_fee, transport_provider, allow_pool
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date, p_start_time, p_end_time,
    p_service_type_id, 1,
    v_total, v_commission, v_rate, v_payout, p_hours_count, p_notes,
    v_lat, v_lng, v_neighborhood, v_address,
    p_transport_legs, v_transport_fee, v_provider, p_allow_pool
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
REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text, time, time, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int, int, text, double precision, double precision, text, time, time, boolean) TO authenticated;

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
--   select
--     (select count(*) from pg_proc where proname='create_booking')            as firmas_create_booking,
--     (select count(*) from information_schema.columns
--      where table_name='booking' and column_name='allow_pool')                as col_allow_pool,
--     (select (pg_get_functiondef(oid) like '%BETWEEN v_min_rate%')
--      from pg_proc where proname='find_escalation_candidates')                as conserva_piso,
--     (select (pg_get_functiondef(oid) like '%search_phase = 3%')
--      from pg_proc where proname='run_booking_cron')                          as conserva_fase3,
--     (select (pg_get_functiondef(oid) like '%allow_pool%')
--      from pg_proc where proname='decline_solicitud')                         as decline_respeta;
--   -- esperado: 1 · 1 · false · false · true
