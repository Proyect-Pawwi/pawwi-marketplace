-- ============================================================
-- TEST auto-limpiante — Horas del cuidado + avance overnight (migración 40)
-- Verifica:
--   • create_booking guarda start_time/end_time.
--   • Overnight (NightCare mismo día, end<=start): el fin real es al día
--     siguiente → advance_all_booking_statuses lo respeta.
-- BORRA todo al final. Requisitos: haber corrido hasta la 40.
-- ============================================================

DROP TABLE IF EXISTS _times;
CREATE TEMP TABLE _times (paso text, resultado text);

DO $$
DECLARE
  v_pawwer uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client uuid;
  v_svc    int;
  v_dog    uuid;
  v_bk     uuid; v_bk2 uuid;
  v_r      json;
  v_st     time; v_et time;
  v_status int; v_status2 int;
  v_avail_existed bool; v_avail_before int;
  v_d date := CURRENT_DATE + 6;
BEGIN
  SELECT id INTO v_client FROM public.profile WHERE role='client' ORDER BY created_at LIMIT 1;
  SELECT id_service INTO v_svc FROM public."service_X_Pawwer" WHERE id_pawwer=v_pawwer AND is_active=true ORDER BY id_service LIMIT 1;
  IF v_client IS NULL OR v_svc IS NULL THEN INSERT INTO _times VALUES('ABORT','falta cliente/servicio'); RETURN; END IF;
  INSERT INTO public.client (id) VALUES (v_client) ON CONFLICT DO NOTHING;

  -- ── create_booking guarda las horas ──
  SELECT slots_remaining INTO v_avail_before FROM public.availability WHERE pawwer_id=v_pawwer AND date=v_d;
  v_avail_existed := FOUND;
  IF NOT v_avail_existed THEN INSERT INTO public.availability(pawwer_id,date,slots_remaining) VALUES(v_pawwer,v_d,1);
  ELSE UPDATE public.availability SET slots_remaining=1 WHERE pawwer_id=v_pawwer AND date=v_d; END IF;

  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__TIME__','Mestizo',2,3,10,'hembra') RETURNING id INTO v_dog;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);
  v_r := public.create_booking(v_pawwer, v_d, v_d, v_svc, ARRAY[v_dog], 'time', NULL, 0, NULL, NULL, NULL, NULL, TIME '08:30', TIME '17:45');
  v_bk := (v_r->>'booking_id')::uuid;
  SELECT start_time, end_time INTO v_st, v_et FROM public.booking WHERE id=v_bk;
  INSERT INTO _times VALUES('create_booking guarda horas', CASE WHEN v_st='08:30' AND v_et='17:45' THEN 'OK' ELSE 'FALLO ('||COALESCE(v_st::text,'null')||' / '||COALESCE(v_et::text,'null')||')' END);
  DELETE FROM public.dog_booking WHERE booking_id=v_bk;
  DELETE FROM public.booking WHERE id=v_bk;

  -- ── Overnight: fin real al día siguiente ──
  -- Caso A: NightCare de anteayer 19:00 → ayer 08:00 (fin real YA pasó) → completa (4)
  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__TIME2__','Mestizo',2,3,10,'macho') RETURNING id INTO v_dog;
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,start_time,end_time,total,commission,pawwer_payout,comments)
  VALUES(v_client,v_pawwer,2,3,1,CURRENT_DATE-2,CURRENT_DATE-2,'19:00','08:00',80000,20000,60000,'[TIME] overnight pasado') RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking(dog_id,booking_id) VALUES(v_dog,v_bk);

  -- Caso B: NightCare que empieza HOY 19:00 → fin real MAÑANA 08:00 (futuro) → sigue en curso (3)
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,start_time,end_time,total,commission,pawwer_payout,comments)
  VALUES(v_client,v_pawwer,2,3,1,CURRENT_DATE,CURRENT_DATE,'19:00','08:00',80000,20000,60000,'[TIME] overnight futuro') RETURNING id INTO v_bk2;

  PERFORM public.advance_all_booking_statuses();
  SELECT status_id INTO v_status  FROM public.booking WHERE id=v_bk;
  SELECT status_id INTO v_status2 FROM public.booking WHERE id=v_bk2;
  INSERT INTO _times VALUES
    ('overnight pasado → completada (4)', CASE WHEN v_status=4 THEN 'OK' ELSE 'FALLO ('||v_status||')' END),
    ('overnight futuro → sigue en curso (3)', CASE WHEN v_status2=3 THEN 'OK' ELSE 'FALLO ('||v_status2||')' END);

  -- Limpieza
  DELETE FROM public.dog_booking WHERE booking_id IN (v_bk,v_bk2);
  DELETE FROM public.booking WHERE id IN (v_bk,v_bk2);
  DELETE FROM public.dog WHERE name IN ('__TIME__','__TIME2__');
  IF NOT v_avail_existed THEN DELETE FROM public.availability WHERE pawwer_id=v_pawwer AND date=v_d;
  ELSE UPDATE public.availability SET slots_remaining=v_avail_before WHERE pawwer_id=v_pawwer AND date=v_d; END IF;
END $$;

SELECT * FROM _times;
