-- ============================================================
-- TEST auto-limpiante de la migración 32
-- Pega y corre completo. Valida:
--   #1  create_booking persiste client_address y las RPCs lo devuelven.
--   #2  Dos solicitudes al mismo pawwer/fecha COEXISTEN (antes solo 1).
--   #3  accept_booking bloquea el cupo; la 2ª aceptación y una 3ª solicitud fallan.
--   #4  cancel_booking → status 5, devuelve el cupo, aparece en "Canceladas".
-- BORRA todo al final y restaura la disponibilidad.
-- ============================================================

DROP TABLE IF EXISTS _stest;
CREATE TEMP TABLE _stest (paso text, resultado text);

DO $$
DECLARE
  v_pawwer        uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client        uuid;
  v_service       int;
  v_dog           uuid;
  v_b1            uuid;
  v_b2            uuid;
  v_r             json;
  v_json          jsonb;
  v_avail_existed bool;
  v_avail_before  int;
  v_slots         int;
  v_count         int;
  v_addr          text := 'Calle Test 123 #45-67, Bogotá';
  v_err           text;
BEGIN
  SELECT id INTO v_client FROM public.profile WHERE role='client' ORDER BY created_at LIMIT 1;
  IF v_client IS NULL THEN INSERT INTO _stest VALUES('ABORT','No hay cliente'); RETURN; END IF;

  SELECT id_service INTO v_service FROM public."service_X_Pawwer"
  WHERE id_pawwer=v_pawwer AND is_active=true ORDER BY id_service LIMIT 1;
  IF v_service IS NULL THEN INSERT INTO _stest VALUES('ABORT','El pawwer no tiene servicio activo'); RETURN; END IF;

  INSERT INTO public.client (id) VALUES (v_client) ON CONFLICT DO NOTHING;

  -- Disponibilidad de 1 cupo hoy (guardando el estado original)
  SELECT slots_remaining INTO v_avail_before FROM public.availability WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  v_avail_existed := FOUND;
  IF NOT v_avail_existed THEN
    INSERT INTO public.availability (pawwer_id,date,slots_remaining) VALUES (v_pawwer,CURRENT_DATE,1);
  ELSE
    UPDATE public.availability SET slots_remaining=1 WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  END IF;

  INSERT INTO public.dog (owner_id,name,breed,size,age,weight_kg,sex,notes)
  VALUES (v_client,'__STEST__','Mestizo',3,4,15.0,'hembra','test solicitudes')
  RETURNING id INTO v_dog;

  -- ── #2: dos solicitudes al mismo pawwer/fecha ──────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);

  v_r  := public.create_booking(v_pawwer, CURRENT_DATE, CURRENT_DATE, v_service, ARRAY[v_dog], 'b1', NULL, 0, v_addr, 4.65, -74.05, 'Chapinero');
  v_b1 := (v_r->>'booking_id')::uuid;
  v_r  := public.create_booking(v_pawwer, CURRENT_DATE, CURRENT_DATE, v_service, ARRAY[v_dog], 'b2', NULL, 0, NULL, NULL, NULL, NULL);
  v_b2 := (v_r->>'booking_id')::uuid;

  INSERT INTO _stest VALUES('#2 ambas solicitudes creadas',
    CASE WHEN v_b1 IS NOT NULL AND v_b2 IS NOT NULL THEN 'OK (b1 y b2)' ELSE 'FALLO: '||COALESCE(v_r::text,'null') END);

  -- Vistas por el pawwer en el feed de pendientes
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_pawwer::text,'role','authenticated')::text, true);
  v_json := public.get_pawwer_bookings(ARRAY[1]);
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_json) e WHERE (e->>'id')::uuid IN (v_b1,v_b2);
  INSERT INTO _stest VALUES('#2 ambas aparecen en get_pawwer_bookings([1])',
    CASE WHEN v_count=2 THEN 'OK (2 de 2)' ELSE 'FALLO ('||v_count||' de 2)' END);

  -- ── #1: client_address persistido y devuelto ───────────────────
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_json) e
  WHERE (e->>'id')::uuid = v_b1 AND e->>'client_address' = v_addr;
  INSERT INTO _stest VALUES('#1 client_address en el feed', CASE WHEN v_count=1 THEN 'OK' ELSE 'FALLO' END);

  -- ── #3: aceptar bloquea el cupo ────────────────────────────────
  PERFORM public.accept_booking(v_b1);
  SELECT slots_remaining INTO v_slots FROM public.availability WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  INSERT INTO _stest VALUES('#3 cupo tras aceptar b1', CASE WHEN v_slots=0 THEN 'OK (0)' ELSE 'FALLO ('||v_slots||')' END);

  -- 2ª aceptación debe fallar por falta de cupo
  BEGIN
    PERFORM public.accept_booking(v_b2);
    INSERT INTO _stest VALUES('#3 aceptar b2 (sin cupo)', 'FALLO: no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    INSERT INTO _stest VALUES('#3 aceptar b2 (sin cupo)', 'OK bloqueado: '||v_err);
  END;

  -- Nueva solicitud del cliente misma fecha debe fallar
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);
  v_r := public.create_booking(v_pawwer, CURRENT_DATE, CURRENT_DATE, v_service, ARRAY[v_dog], 'b3', NULL, 0, NULL, NULL, NULL, NULL);
  INSERT INTO _stest VALUES('#3 nueva solicitud sin cupo',
    CASE WHEN v_r->>'error' IS NOT NULL THEN 'OK: '||(v_r->>'error') ELSE 'FALLO: se creó '||COALESCE(v_r->>'booking_id','?') END);

  -- ── #4: cancelar cuidado confirmado ────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_pawwer::text,'role','authenticated')::text, true);
  PERFORM public.cancel_booking(v_b1);
  SELECT slots_remaining INTO v_slots FROM public.availability WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  INSERT INTO _stest VALUES('#4 cupo devuelto tras cancelar', CASE WHEN v_slots=1 THEN 'OK (1)' ELSE 'FALLO ('||v_slots||')' END);

  v_json := public.get_pawwer_bookings(ARRAY[5]);
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_json) e WHERE (e->>'id')::uuid = v_b1;
  INSERT INTO _stest VALUES('#4 aparece en Canceladas ([5])', CASE WHEN v_count=1 THEN 'OK' ELSE 'FALLO' END);

  -- ── Limpieza ───────────────────────────────────────────────────
  DELETE FROM public.notifications WHERE booking_id IN (v_b1,v_b2);
  DELETE FROM public.messages      WHERE booking_id IN (v_b1,v_b2);
  DELETE FROM public.dog_booking   WHERE booking_id IN (v_b1,v_b2);
  DELETE FROM public.booking       WHERE id         IN (v_b1,v_b2);
  DELETE FROM public.dog           WHERE id = v_dog;
  IF NOT v_avail_existed THEN
    DELETE FROM public.availability WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  ELSE
    UPDATE public.availability SET slots_remaining=v_avail_before WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  END IF;
END $$;

SELECT * FROM _stest;
