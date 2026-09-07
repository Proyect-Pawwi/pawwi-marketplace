-- ============================================================
-- TEST auto-limpiante del transporte (migración 29)
-- Pega y corre completo. Crea una reserva CON transporte (ida y vuelta),
-- prueba el reparto pawwer vs pawwi, y BORRA todo al final.
-- Restaura el transport_price del pawwer a su valor original.
-- ============================================================

DROP TABLE IF EXISTS _ttest;
CREATE TEMP TABLE _ttest (paso text, resultado text);

DO $$
DECLARE
  v_pawwer        uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client        uuid;
  v_service       int;
  v_dog           uuid;
  v_booking       uuid;
  v_result        json;
  v_orig_tp       numeric;
  v_avail_existed bool;
  v_avail_before  int;
  v_fee           numeric;
  v_prov_default  text;
  v_pay_default   numeric;
  v_pay_pawwi     numeric;
  v_pay_pawwer    numeric;
BEGIN
  SELECT id INTO v_client FROM public.profile WHERE role='client' AND latitude IS NOT NULL ORDER BY created_at LIMIT 1;
  IF v_client IS NULL THEN INSERT INTO _ttest VALUES('ABORT','No hay cliente con ubicación'); RETURN; END IF;

  SELECT id_service INTO v_service FROM public."service_X_Pawwer"
  WHERE id_pawwer=v_pawwer AND is_active=true ORDER BY id_service LIMIT 1;
  IF v_service IS NULL THEN INSERT INTO _ttest VALUES('ABORT','El pawwer no tiene servicio activo'); RETURN; END IF;

  -- Poner transport_price de prueba ($20.000), guardando el original
  SELECT transport_price INTO v_orig_tp FROM public.pawwer WHERE id=v_pawwer;
  UPDATE public.pawwer SET transport_price=20000 WHERE id=v_pawwer;

  INSERT INTO public.client (id) VALUES (v_client) ON CONFLICT DO NOTHING;

  SELECT slots_remaining INTO v_avail_before FROM public.availability WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  v_avail_existed := FOUND;
  IF NOT v_avail_existed THEN
    INSERT INTO public.availability (pawwer_id,date,slots_remaining) VALUES (v_pawwer,CURRENT_DATE,1);
  ELSIF v_avail_before < 1 THEN
    UPDATE public.availability SET slots_remaining=1 WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  END IF;

  INSERT INTO public.dog (owner_id,name,breed,size,age,weight_kg,sex,notes)
  VALUES (v_client,'__TTEST__','Mestizo',3,4,15.0,'hembra','test transporte')
  RETURNING id INTO v_dog;

  -- Cliente reserva con transporte ida y vuelta (2 trayectos)
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);
  v_result := public.create_booking(v_pawwer, CURRENT_DATE, CURRENT_DATE, v_service, ARRAY[v_dog], 'test', NULL, 2);
  v_booking := (v_result->>'booking_id')::uuid;
  IF v_booking IS NULL THEN
    INSERT INTO _ttest VALUES('ABORT','create_booking falló: '||v_result::text);
    UPDATE public.pawwer SET transport_price=v_orig_tp WHERE id=v_pawwer;
    DELETE FROM public.dog WHERE id=v_dog;
    RETURN;
  END IF;

  SELECT transport_fee, transport_provider, pawwer_payout INTO v_fee, v_prov_default, v_pay_default
  FROM public.booking WHERE id=v_booking;

  -- Simular aceptación (status confirmado) y elegir proveedor (como el pawwer)
  UPDATE public.booking SET status_id=2 WHERE id=v_booking;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_pawwer::text,'role','authenticated')::text, true);

  PERFORM public.set_transport_provider(v_booking, 'pawwi');
  SELECT pawwer_payout INTO v_pay_pawwi FROM public.booking WHERE id=v_booking;

  PERFORM public.set_transport_provider(v_booking, 'pawwer');
  SELECT pawwer_payout INTO v_pay_pawwer FROM public.booking WHERE id=v_booking;

  INSERT INTO _ttest VALUES
    ('transport_fee (2 × $20k)',         to_char(v_fee,'FM999G999G999')),
    ('provider por defecto',             COALESCE(v_prov_default,'NULL')),
    ('payout default (pawwer lo toma)',  to_char(v_pay_default,'FM999G999G999')),
    ('payout si lo toma Pawwi',          to_char(v_pay_pawwi,'FM999G999G999')),
    ('payout si lo toma el pawwer',      to_char(v_pay_pawwer,'FM999G999G999')),
    ('diferencia (transporte × 75%)',    to_char(v_pay_pawwer - v_pay_pawwi,'FM999G999G999'));

  -- ── Limpieza ──
  DELETE FROM public.dog_booking WHERE booking_id=v_booking;
  DELETE FROM public.booking WHERE id=v_booking;
  DELETE FROM public.dog WHERE id=v_dog;
  UPDATE public.pawwer SET transport_price=v_orig_tp WHERE id=v_pawwer;
  IF NOT v_avail_existed THEN
    DELETE FROM public.availability WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  ELSE
    UPDATE public.availability SET slots_remaining=v_avail_before WHERE pawwer_id=v_pawwer AND date=CURRENT_DATE;
  END IF;
END $$;

SELECT * FROM _ttest;
