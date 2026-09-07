-- ============================================================
-- TEST auto-limpiante de la tubería (migración 27)
-- Pega y corre completo. Crea un perro+booking+reseña de prueba,
-- verifica el comportamiento y BORRA todo al final (no deja basura).
-- El resultado sale en la tabla final (pégamelo).
-- ============================================================

DROP TABLE IF EXISTS _ptest;
CREATE TEMP TABLE _ptest (paso text, resultado text);

DO $$
DECLARE
  v_pawwer       uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client       uuid;
  v_service      int;
  v_dog          uuid;
  v_booking      uuid;
  v_result       json;
  v_blat         double precision;
  v_bnb          text;
  v_notif        text;
  v_rating_before numeric;
  v_rating_after  numeric;
  v_avail_existed bool;
  v_avail_before  int;
BEGIN
  -- Cliente con ubicación
  SELECT id INTO v_client FROM public.profile
  WHERE role = 'client' AND latitude IS NOT NULL
  ORDER BY created_at LIMIT 1;
  IF v_client IS NULL THEN
    INSERT INTO _ptest VALUES ('ABORT', 'No hay cliente con ubicación'); RETURN;
  END IF;

  -- Servicio activo del pawwer
  SELECT id_service INTO v_service FROM public."service_X_Pawwer"
  WHERE id_pawwer = v_pawwer AND is_active = true
  ORDER BY id_service LIMIT 1;
  IF v_service IS NULL THEN
    INSERT INTO _ptest VALUES ('ABORT', 'El pawwer no tiene servicio activo (service_X_Pawwer)'); RETURN;
  END IF;

  INSERT INTO public.client (id) VALUES (v_client) ON CONFLICT DO NOTHING;

  -- Asegurar disponibilidad hoy (recordando el estado para restaurar)
  SELECT slots_remaining INTO v_avail_before
  FROM public.availability WHERE pawwer_id = v_pawwer AND date = CURRENT_DATE;
  v_avail_existed := FOUND;
  IF NOT v_avail_existed THEN
    INSERT INTO public.availability (pawwer_id, date, slots_remaining) VALUES (v_pawwer, CURRENT_DATE, 1);
  ELSIF v_avail_before < 1 THEN
    UPDATE public.availability SET slots_remaining = 1 WHERE pawwer_id = v_pawwer AND date = CURRENT_DATE;
  END IF;

  -- Perro de prueba del cliente (con peso/sexo)
  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex, notes)
  VALUES (v_client, '__PTEST__', 'Mestizo', 3, 4, 15.0, 'hembra', 'test pipeline')
  RETURNING id INTO v_dog;

  -- Impersonar al cliente → auth.uid() = v_client dentro de create_booking
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_client::text, 'role', 'authenticated')::text, true);

  -- Llamada REAL al RPC
  v_result := public.create_booking(v_pawwer, CURRENT_DATE, CURRENT_DATE, v_service,
                                    ARRAY[v_dog], 'Reserva de prueba pipeline', NULL);
  v_booking := (v_result->>'booking_id')::uuid;

  IF v_booking IS NOT NULL THEN
    -- H1: ¿copió la ubicación del cliente?
    SELECT client_lat, client_neighborhood INTO v_blat, v_bnb
    FROM public.booking WHERE id = v_booking;

    -- Notificación generada por el trigger
    SELECT title INTO v_notif FROM public.notifications
    WHERE booking_id = v_booking AND type = 'cuidado'
    ORDER BY created_at DESC LIMIT 1;

    -- H4: trigger de rating (reseña 5★)
    SELECT rating INTO v_rating_before FROM public.pawwer WHERE id = v_pawwer;
    INSERT INTO public.reviews (booking_id, client_id, pawwer_id, rating, comment)
    VALUES (v_booking, v_client, v_pawwer, 5, 'ptest');
    SELECT rating INTO v_rating_after FROM public.pawwer WHERE id = v_pawwer;
    DELETE FROM public.reviews WHERE booking_id = v_booking;  -- recalcula de vuelta
  END IF;

  INSERT INTO _ptest VALUES
    ('create_booking',                  COALESCE(v_result::text, 'NULL')),
    ('H1 · client_lat en booking',      COALESCE(v_blat::text, 'NULL (❌)')),
    ('H1 · client_neighborhood',        COALESCE(v_bnb, 'NULL (❌)')),
    ('notificación al pawwer',          COALESCE(v_notif, '(ninguna ❌)')),
    ('H4 · rating antes→con reseña 5★', COALESCE(v_rating_before::text,'?') || ' → ' || COALESCE(v_rating_after::text,'?'));

  -- ── Limpieza total ──
  IF v_booking IS NOT NULL THEN
    DELETE FROM public.dog_booking WHERE booking_id = v_booking;
    DELETE FROM public.booking WHERE id = v_booking;   -- notifications cascadean
  END IF;
  DELETE FROM public.dog WHERE id = v_dog;
  IF NOT v_avail_existed THEN
    DELETE FROM public.availability WHERE pawwer_id = v_pawwer AND date = CURRENT_DATE;
  ELSE
    UPDATE public.availability SET slots_remaining = v_avail_before
    WHERE pawwer_id = v_pawwer AND date = CURRENT_DATE;
  END IF;
END $$;

SELECT * FROM _ptest;
