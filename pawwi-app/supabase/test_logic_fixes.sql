-- ============================================================
-- TEST auto-limpiante — Ajustes A1/A2/A3/A4
-- Pega y corre completo. BORRA y restaura todo al final.
-- Requisitos: haber corrido hasta la 38.
--   A1: comisión 20% para pawwer élite (rating≥4.8 + reseñas≥15).
--   A2: create_review valida completada + no duplicada + no-completada.
--   A3: advance_all_booking_statuses (global) completa un cuidado pasado.
--   A4: cancel_booking_client (confirmada→cancelada, devuelve cupo).
-- ============================================================

DROP TABLE IF EXISTS _lfx;
CREATE TEMP TABLE _lfx (paso text, resultado text);

DO $$
DECLARE
  v_pawwer   uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client   uuid;
  v_service  int;
  v_dog      uuid;
  v_bk       uuid;
  v_r        json;
  v_rate     numeric;
  v_status   int;
  v_slots    int;
  v_orig_rating  numeric;
  v_orig_reviews int;
  v_avail_existed bool;
  v_avail_before  int;
  v_d1       date := CURRENT_DATE + 5;   -- fecha futura para A1/A4
BEGIN
  SELECT id INTO v_client FROM public.profile WHERE role='client' ORDER BY created_at LIMIT 1;
  IF v_client IS NULL THEN INSERT INTO _lfx VALUES('ABORT','No hay cliente'); RETURN; END IF;
  SELECT id_service INTO v_service FROM public."service_X_Pawwer"
  WHERE id_pawwer=v_pawwer AND is_active=true ORDER BY id_service LIMIT 1;
  IF v_service IS NULL THEN INSERT INTO _lfx VALUES('ABORT','Pawwer sin servicio activo'); RETURN; END IF;
  INSERT INTO public.client (id) VALUES (v_client) ON CONFLICT DO NOTHING;

  -- Guardar rating original para restaurar
  SELECT rating, reviews_count INTO v_orig_rating, v_orig_reviews FROM public.pawwer WHERE id=v_pawwer;

  -- ════════ A1 — comisión 20% para élite ════════
  -- disponibilidad para la fecha
  SELECT slots_remaining INTO v_avail_before FROM public.availability WHERE pawwer_id=v_pawwer AND date=v_d1;
  v_avail_existed := FOUND;
  IF NOT v_avail_existed THEN INSERT INTO public.availability(pawwer_id,date,slots_remaining) VALUES(v_pawwer,v_d1,1);
  ELSE UPDATE public.availability SET slots_remaining=1 WHERE pawwer_id=v_pawwer AND date=v_d1; END IF;

  UPDATE public.pawwer SET rating=4.9, reviews_count=20 WHERE id=v_pawwer;

  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__LFX__','Mestizo',2,3,10,'hembra') RETURNING id INTO v_dog;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);
  v_r  := public.create_booking(v_pawwer, v_d1, v_d1, v_service, ARRAY[v_dog], 'lfx', NULL, 0, NULL, NULL, NULL, NULL);
  v_bk := (v_r->>'booking_id')::uuid;
  SELECT commission_rate INTO v_rate FROM public.booking WHERE id=v_bk;
  INSERT INTO _lfx VALUES('A1 comisión élite = 20%', CASE WHEN v_rate=0.20 THEN 'OK' ELSE 'FALLO ('||COALESCE(v_rate::text,'null')||')' END);

  DELETE FROM public.dog_booking WHERE booking_id=v_bk;
  DELETE FROM public.booking WHERE id=v_bk;
  DELETE FROM public.dog WHERE id=v_dog;

  -- ════════ A2 — create_review ════════
  -- cuidado COMPLETADO (status 4)
  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__LFX2__','Mestizo',2,3,10,'macho') RETURNING id INTO v_dog;
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,total,commission,pawwer_payout,comments)
  VALUES(v_client,v_pawwer,v_service,4,1,CURRENT_DATE-3,CURRENT_DATE-3,80000,20000,60000,'[LFX] completada') RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking(dog_id,booking_id) VALUES(v_dog,v_bk);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);
  v_r := public.create_review(v_bk, 5, 'Excelente cuidado');
  INSERT INTO _lfx VALUES('A2 reseña en completada', CASE WHEN v_r->>'ok'='true' THEN 'OK' ELSE 'FALLO: '||COALESCE(v_r->>'error','?') END);

  v_r := public.create_review(v_bk, 4, 'otra');
  INSERT INTO _lfx VALUES('A2 reseña duplicada rechazada', CASE WHEN v_r->>'error' IS NOT NULL THEN 'OK: '||(v_r->>'error') ELSE 'FALLO' END);

  DELETE FROM public.reviews WHERE booking_id=v_bk;
  DELETE FROM public.dog_booking WHERE booking_id=v_bk;
  DELETE FROM public.booking WHERE id=v_bk;
  DELETE FROM public.dog WHERE id=v_dog;

  -- reseña en NO-completada (status 2) → error
  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__LFX3__','Mestizo',2,3,10,'hembra') RETURNING id INTO v_dog;
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,total,commission,pawwer_payout,comments)
  VALUES(v_client,v_pawwer,v_service,2,1,CURRENT_DATE+4,CURRENT_DATE+4,80000,20000,60000,'[LFX] confirmada') RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking(dog_id,booking_id) VALUES(v_dog,v_bk);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);
  v_r := public.create_review(v_bk, 5, 'no deberia');
  INSERT INTO _lfx VALUES('A2 reseña en no-completada rechazada', CASE WHEN v_r->>'error' IS NOT NULL THEN 'OK: '||(v_r->>'error') ELSE 'FALLO' END);
  DELETE FROM public.dog_booking WHERE booking_id=v_bk;
  DELETE FROM public.booking WHERE id=v_bk;
  DELETE FROM public.dog WHERE id=v_dog;

  -- ════════ A3 — avance global ════════
  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__LFX4__','Mestizo',2,3,10,'macho') RETURNING id INTO v_dog;
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,total,commission,pawwer_payout,comments)
  VALUES(v_client,v_pawwer,v_service,2,1,CURRENT_DATE-2,CURRENT_DATE-2,80000,20000,60000,'[LFX] pasada') RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking(dog_id,booking_id) VALUES(v_dog,v_bk);
  PERFORM public.advance_all_booking_statuses();
  SELECT status_id INTO v_status FROM public.booking WHERE id=v_bk;
  INSERT INTO _lfx VALUES('A3 avance global (pasada→completada)', CASE WHEN v_status=4 THEN 'OK' ELSE 'FALLO ('||v_status||')' END);
  DELETE FROM public.dog_booking WHERE booking_id=v_bk;
  DELETE FROM public.booking WHERE id=v_bk;
  DELETE FROM public.dog WHERE id=v_dog;

  -- ════════ A4 — cancelación del cliente ════════
  UPDATE public.availability SET slots_remaining=0 WHERE pawwer_id=v_pawwer AND date=v_d1;  -- simula cupo tomado por accept
  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__LFX5__','Mestizo',2,3,10,'hembra') RETURNING id INTO v_dog;
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,total,commission,pawwer_payout,comments)
  VALUES(v_client,v_pawwer,v_service,2,1,v_d1,v_d1,80000,20000,60000,'[LFX] a cancelar') RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking(dog_id,booking_id) VALUES(v_dog,v_bk);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client::text,'role','authenticated')::text, true);
  PERFORM public.cancel_booking_client(v_bk);
  SELECT status_id INTO v_status FROM public.booking WHERE id=v_bk;
  SELECT slots_remaining INTO v_slots FROM public.availability WHERE pawwer_id=v_pawwer AND date=v_d1;
  INSERT INTO _lfx VALUES('A4 cliente cancela (status→5)', CASE WHEN v_status=5 THEN 'OK' ELSE 'FALLO ('||v_status||')' END);
  INSERT INTO _lfx VALUES('A4 cupo devuelto (0→1)', CASE WHEN v_slots=1 THEN 'OK' ELSE 'FALLO ('||v_slots||')' END);
  DELETE FROM public.notifications WHERE booking_id=v_bk;
  DELETE FROM public.messages WHERE booking_id=v_bk;
  DELETE FROM public.dog_booking WHERE booking_id=v_bk;
  DELETE FROM public.booking WHERE id=v_bk;
  DELETE FROM public.dog WHERE id=v_dog;

  -- ════════ Restaurar estado ════════
  UPDATE public.pawwer SET rating=v_orig_rating, reviews_count=v_orig_reviews WHERE id=v_pawwer;
  IF NOT v_avail_existed THEN DELETE FROM public.availability WHERE pawwer_id=v_pawwer AND date=v_d1;
  ELSE UPDATE public.availability SET slots_remaining=v_avail_before WHERE pawwer_id=v_pawwer AND date=v_d1; END IF;
END $$;

SELECT * FROM _lfx;
