-- ============================================================
-- TEST auto-limpiante — Solicitud fase-1 VENCIDA se escala y suelta al pawwer
-- Pega y corre completo. Verifica que advance_booking_statuses:
--   • escala la solicitud vencida a fase 2,
--   • suelta el pawwer_id (deja de aparecerle),
--   • la saca de get_pawwer_bookings([1]) del pawwer original.
-- BORRA todo al final.
-- Requisitos: haber corrido hasta la 34.
-- ============================================================

DROP TABLE IF EXISTS _xtest;
CREATE TEMP TABLE _xtest (paso text, resultado text);

DO $$
DECLARE
  v_pawwer   uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client   uuid;
  v_dog      uuid;
  v_bk       uuid;
  v_phase    smallint;
  v_pawwer_after uuid;
  v_status   int;
  v_cands    int;
  v_in_feed  int;
  v_json     jsonb;
BEGIN
  SELECT c.id INTO v_client FROM public.client c WHERE c.id <> v_pawwer ORDER BY c.id LIMIT 1;
  IF v_client IS NULL THEN INSERT INTO _xtest VALUES('ABORT','No hay clientes'); RETURN; END IF;

  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex)
  VALUES (v_client, '__XTEST__', 'Mestizo', 2, 3, 12.0, 'hembra') RETURNING id INTO v_dog;

  -- Solicitud fase-1 asignada al pawwer, con timer YA VENCIDO
  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, total, commission, pawwer_payout,
    phase_expires_at, comments
  ) VALUES (
    v_client, v_pawwer, 1, 1, 1,
    CURRENT_DATE + 3, CURRENT_DATE + 3, 80000, 20000, 60000,
    now() - INTERVAL '1 minute', '[EXP] solicitud vencida'
  ) RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog, v_bk);

  -- El pawwer abre la app → corre advance_booking_statuses
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_pawwer::text, 'role','authenticated')::text, true);
  PERFORM public.advance_booking_statuses();

  SELECT search_phase, pawwer_id, status_id INTO v_phase, v_pawwer_after, v_status
  FROM public.booking WHERE id = v_bk;
  SELECT count(*) INTO v_cands FROM public.booking_candidates WHERE booking_id = v_bk;

  v_json := public.get_pawwer_bookings(ARRAY[1]);
  SELECT count(*) INTO v_in_feed FROM jsonb_array_elements(v_json) e WHERE (e->>'id')::uuid = v_bk;

  INSERT INTO _xtest VALUES
    ('escaló a fase 2',            CASE WHEN v_phase = 2 THEN 'OK' ELSE 'FALLO ('||v_phase||')' END),
    ('soltó el pawwer_id',         CASE WHEN v_pawwer_after IS NULL THEN 'OK' ELSE 'FALLO' END),
    ('sigue status=1 (pendiente)', CASE WHEN v_status = 1 THEN 'OK' ELSE 'FALLO ('||v_status||')' END),
    ('ya NO le aparece al pawwer', CASE WHEN v_in_feed = 0 THEN 'OK' ELSE 'FALLO' END),
    ('candidatos fase 2 insertados', v_cands || ' (informativo, depende de pawwers elegibles)');

  -- ── Limpieza ──
  DELETE FROM public.booking_candidates WHERE booking_id = v_bk;
  DELETE FROM public.notifications      WHERE booking_id = v_bk;
  DELETE FROM public.dog_booking        WHERE booking_id = v_bk;
  DELETE FROM public.booking            WHERE id = v_bk;
  DELETE FROM public.dog                WHERE id = v_dog;
END $$;

SELECT * FROM _xtest;
