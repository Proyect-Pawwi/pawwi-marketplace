-- ============================================================
-- TEST auto-limpiante — run_booking_cron (cron SQL, migración 39)
-- Verifica de una corrida:
--   • Fase 1 vencida → escala a fase 2 + suelta pawwer_id.
--   • Fase 3 vencida → sin_cuidador (status 6).
--   • Confirmada pasada → completada (status 4).
-- BORRA todo al final. Requisitos: haber corrido hasta la 39.
-- ============================================================

DROP TABLE IF EXISTS _cron;
CREATE TEMP TABLE _cron (paso text, resultado text);

DO $$
DECLARE
  v_pawwer uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client uuid;
  v_svc    int;
  v_dog    uuid;
  v_b1 uuid; v_b3 uuid; v_b4 uuid;
  v_phase smallint; v_paw uuid; v_s1 int; v_s3 int; v_s4 int;
BEGIN
  SELECT id INTO v_client FROM public.profile WHERE role='client' ORDER BY created_at LIMIT 1;
  SELECT id_service INTO v_svc FROM public."service_X_Pawwer" WHERE id_pawwer=v_pawwer AND is_active=true ORDER BY id_service LIMIT 1;
  IF v_client IS NULL OR v_svc IS NULL THEN INSERT INTO _cron VALUES('ABORT','falta cliente/servicio'); RETURN; END IF;
  INSERT INTO public.client (id) VALUES (v_client) ON CONFLICT DO NOTHING;

  INSERT INTO public.dog(owner_id,name,breed,size,age,weight_kg,sex)
  VALUES(v_client,'__CRON__','Mestizo',2,3,10,'hembra') RETURNING id INTO v_dog;

  -- Fase 1 vencida
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,total,commission,pawwer_payout,phase_expires_at,comments)
  VALUES(v_client,v_pawwer,v_svc,1,1,CURRENT_DATE+3,CURRENT_DATE+3,80000,20000,60000,now()-INTERVAL '1 min','[CRON] f1') RETURNING id INTO v_b1;
  INSERT INTO public.dog_booking(dog_id,booking_id) VALUES(v_dog,v_b1);

  -- Fase 3 vencida
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,total,commission,pawwer_payout,phase_expires_at,comments)
  VALUES(v_client,NULL,v_svc,1,3,CURRENT_DATE+3,CURRENT_DATE+3,80000,20000,60000,now()-INTERVAL '1 min','[CRON] f3') RETURNING id INTO v_b3;

  -- Confirmada pasada
  INSERT INTO public.booking(client_id,pawwer_id,service_type_id,status_id,search_phase,start_date,end_date,total,commission,pawwer_payout,comments)
  VALUES(v_client,v_pawwer,v_svc,2,1,CURRENT_DATE-2,CURRENT_DATE-2,80000,20000,60000,'[CRON] pasada') RETURNING id INTO v_b4;

  -- Correr el cron
  PERFORM public.run_booking_cron();

  SELECT search_phase, pawwer_id INTO v_phase, v_paw FROM public.booking WHERE id=v_b1;
  SELECT status_id INTO v_s3 FROM public.booking WHERE id=v_b3;
  SELECT status_id INTO v_s4 FROM public.booking WHERE id=v_b4;

  INSERT INTO _cron VALUES
    ('fase 1 vencida → fase 2 + sin pawwer', CASE WHEN v_phase=2 AND v_paw IS NULL THEN 'OK' ELSE 'FALLO (fase '||v_phase||', paw '||COALESCE(v_paw::text,'null')||')' END),
    ('fase 3 vencida → sin_cuidador (6)',    CASE WHEN v_s3=6 THEN 'OK' ELSE 'FALLO ('||v_s3||')' END),
    ('confirmada pasada → completada (4)',   CASE WHEN v_s4=4 THEN 'OK' ELSE 'FALLO ('||v_s4||')' END);

  -- Limpieza
  DELETE FROM public.notifications WHERE booking_id IN (v_b1,v_b3,v_b4);
  DELETE FROM public.booking_candidates WHERE booking_id IN (v_b1,v_b3,v_b4);
  DELETE FROM public.dog_booking WHERE booking_id IN (v_b1,v_b3,v_b4);
  DELETE FROM public.booking WHERE id IN (v_b1,v_b3,v_b4);
  DELETE FROM public.dog WHERE id=v_dog;
END $$;

SELECT * FROM _cron;
