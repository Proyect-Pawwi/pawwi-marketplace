-- ============================================================
-- TEST — Cuidados en cada ESTADO para ver las pestañas de "Mis Cuidados"
-- Pawwer de prueba: 2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8
--
-- Siembra 4 cuidados con fechas que, tras advance_booking_statuses (que corre
-- al abrir Home/Cuidados), caen en cada pestaña:
--   • Luna — CONFIRMADA (inicia en 2 días)                → "Confirmadas"
--   • Toby — EN CURSO   (inició ayer, termina mañana)     → "En curso"   (2→3)
--   • Max  — COMPLETADA (fue hace 2-3 días)               → "Completadas" (2→3→4)
--   • Nina — CANCELADA  (estado 5 directo)                → "Canceladas"
--
-- Requisitos: haber corrido hasta la 33.
-- Uso: pega todo y Run. Re-ejecutable. NO se auto-borra.
-- Nota: los estados 3 y 4 los aplica advance_booking_statuses al abrir la app.
-- ============================================================

DO $$
DECLARE
  v_pawwer uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client uuid;
  v_dog    uuid;
  v_bk     uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pawwer WHERE id = v_pawwer) THEN
    RAISE EXCEPTION 'El pawwer % no existe', v_pawwer;
  END IF;

  -- Limpieza previa (re-ejecutable)
  DELETE FROM public.messages    WHERE booking_id IN (SELECT id FROM public.booking WHERE comments LIKE '[EST]%');
  DELETE FROM public.dog_booking WHERE booking_id IN (SELECT id FROM public.booking WHERE comments LIKE '[EST]%');
  DELETE FROM public.booking     WHERE comments LIKE '[EST]%';
  DELETE FROM public.dog         WHERE name IN ('Luna', 'Toby', 'Max', 'Nina') AND breed = 'Criollo';

  SELECT c.id INTO v_client FROM public.client c WHERE c.id <> v_pawwer ORDER BY c.id LIMIT 1;
  IF v_client IS NULL THEN RAISE EXCEPTION 'No hay clientes'; END IF;

  -- Helper inline: crea perro + booking. Repetimos por claridad.

  -- ── CONFIRMADA (inicia en 2 días) — estado 2, se queda en 2 ──
  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex)
  VALUES (v_client, 'Luna', 'Criollo', 2, 3, 12.0, 'hembra') RETURNING id INTO v_dog;
  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, start_time, end_time,
    total, commission, pawwer_payout, comments,
    client_lat, client_lng, client_neighborhood, client_address
  ) VALUES (
    v_client, v_pawwer, 1, 2, 1,
    CURRENT_DATE + 2, CURRENT_DATE + 2, '08:00', '18:00',
    80000, 20000, 60000, '[EST] Confirmada próxima',
    4.6975, -74.0405, 'Usaquén', 'Calle 116 # 15-45, Usaquén, Bogotá'
  ) RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog, v_bk);

  -- ── EN CURSO (inició ayer, termina mañana) — estado 2 → advance 2→3 ──
  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex)
  VALUES (v_client, 'Toby', 'Criollo', 3, 5, 20.0, 'macho') RETURNING id INTO v_dog;
  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, start_time, end_time,
    total, commission, pawwer_payout, comments,
    client_lat, client_lng, client_neighborhood, client_address
  ) VALUES (
    v_client, v_pawwer, 2, 2, 1,
    CURRENT_DATE - 1, CURRENT_DATE + 1, '08:00', '18:00',
    150000, 37500, 112500, '[EST] En curso ahora',
    4.6560, -74.0578, 'Chapinero', 'Carrera 7 # 72-30, Chapinero, Bogotá'
  ) RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog, v_bk);

  -- ── COMPLETADA (fue hace 2-3 días) — estado 2 → advance 2→3→4 ──
  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex)
  VALUES (v_client, 'Max', 'Criollo', 3, 4, 18.0, 'macho') RETURNING id INTO v_dog;
  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, start_time, end_time,
    total, commission, pawwer_payout, comments,
    client_lat, client_lng, client_neighborhood, client_address
  ) VALUES (
    v_client, v_pawwer, 1, 2, 1,
    CURRENT_DATE - 3, CURRENT_DATE - 2, '08:00', '18:00',
    120000, 30000, 90000, '[EST] Completada pasada',
    4.6975, -74.0405, 'Usaquén', 'Calle 100 # 8-20, Bogotá'
  ) RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog, v_bk);

  -- ── CANCELADA — estado 5 directo ──
  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex)
  VALUES (v_client, 'Nina', 'Criollo', 1, 2, 6.0, 'hembra') RETURNING id INTO v_dog;
  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, start_time, end_time,
    total, commission, pawwer_payout, comments,
    client_lat, client_lng, client_neighborhood, client_address
  ) VALUES (
    v_client, v_pawwer, 1, 5, 1,
    CURRENT_DATE - 1, CURRENT_DATE - 1, '08:00', '18:00',
    80000, 20000, 60000, '[EST] Cancelada',
    4.6560, -74.0578, 'Chapinero', 'Carrera 15 # 88-10, Bogotá'
  ) RETURNING id INTO v_bk;
  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog, v_bk);

  RAISE NOTICE '✅ Sembrados 4 cuidados: Luna=confirmada, Toby=en curso, Max=completada, Nina=cancelada';
END $$;

-- Simular el avance por tiempo (lo mismo que hace la app al abrir Home/Cuidados)
-- para verlo aquí de una vez. La app lo repite por su cuenta.
SELECT set_config('request.jwt.claims',
  json_build_object('sub','2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8','role','authenticated')::text, true);
SELECT public.advance_booking_statuses();

-- Verificar el estado resultante de cada cuidado sembrado
SELECT b.comments, b.status_id, s.name AS estado, b.start_date, b.end_date, d.name AS perro
FROM   public.booking b
JOIN   public.booking_status s ON s.id = b.status_id
JOIN   public.dog_booking db   ON db.booking_id = b.id
JOIN   public.dog d            ON d.id = db.dog_id
WHERE  b.comments LIKE '[EST]%'
ORDER  BY b.status_id;

-- ── (Opcional) Limpiar después: ────────────────────────────────────
-- DELETE FROM public.booking WHERE comments LIKE '[EST]%';
-- DELETE FROM public.dog     WHERE name IN ('Luna','Toby','Max','Nina') AND breed = 'Criollo';
