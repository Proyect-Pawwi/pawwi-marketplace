-- ============================================================
-- TEST — Crear cuidados de prueba VISIBLES en localhost (fase 1 directo)
-- Pawwer de prueba: 2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8 (Suba, approved)
--
-- Crea DOS solicitudes pendientes para el mismo pawwer:
--   1) Bimba — DayCare hoy, CON transporte ida y vuelta, dirección Usaquén.
--   2) Rocco — DayCare hoy, SIN transporte, dirección Chapinero.
-- Demuestra de una corrida:
--   • #1 dirección del cliente tappable → Google Maps (client_address)
--   • #2 varias solicitudes a la vez en el home
--   • Notificación "Nueva solicitud" + desglose de ganancia (cuidado vs transporte)
--
-- Requisitos: haber corrido hasta la 32 en este editor.
-- Uso: pega todo y dale Run. Re-ejecutable (limpia lo anterior). NO se auto-borra.
-- ============================================================

DO $$
DECLARE
  v_pawwer  uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';  -- tu cuenta de pawwer
  v_client  uuid;
  v_dog1    uuid;
  v_dog2    uuid;
  v_b1      uuid;
  v_b2      uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pawwer WHERE id = v_pawwer) THEN
    RAISE EXCEPTION 'El pawwer % no existe', v_pawwer;
  END IF;

  -- ── Limpiar pruebas anteriores (re-ejecutable sin acumular) ──
  DELETE FROM public.messages     WHERE booking_id IN (SELECT id FROM public.booking WHERE comments LIKE '[PRUEBA]%');
  DELETE FROM public.dog_booking  WHERE booking_id IN (SELECT id FROM public.booking WHERE comments LIKE '[PRUEBA]%');
  DELETE FROM public.booking      WHERE comments LIKE '[PRUEBA]%';  -- candidatos + notifs cascadean
  DELETE FROM public.dog          WHERE name IN ('Bimba', 'Rocco');

  -- Toma cualquier cliente existente (distinto del pawwer)
  SELECT c.id INTO v_client
  FROM   public.client c
  WHERE  c.id <> v_pawwer
  ORDER  BY c.id
  LIMIT  1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'No hay clientes en la tabla client para asignar el booking';
  END IF;

  -- ── Perro 1: Bimba (con notas → alerta operativa en el detalle) ──
  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex, notes, photo_url)
  VALUES (
    v_client, 'Bimba', 'Mestizo', 3, 4, 15.0, 'hembra',
    'Necesita su pastilla a las 8:00 am. Muy sociable con otros perros.',
    'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop'
  )
  RETURNING id INTO v_dog1;

  -- ── Perro 2: Rocco ──
  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex, notes, photo_url)
  VALUES (
    v_client, 'Rocco', 'Golden Retriever', 3, 3, 28.0, 'macho',
    'Muy juguetón, le encanta correr en el parque.',
    'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=800&auto=format&fit=crop'
  )
  RETURNING id INTO v_dog2;

  -- ── Solicitud 1: DayCare HOY, CON transporte ida y vuelta ($40k) ──
  --   cuidado 80k + transporte 40k = total 120k.
  --   comisión = 25% cuidado (20k) + 25% transporte (10k) = 30k → payout 90k.
  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, start_time, end_time,
    total, commission, pawwer_payout, phase_expires_at, comments,
    client_lat, client_lng, client_neighborhood, client_address,
    transport_legs, transport_fee, transport_provider
  ) VALUES (
    v_client, v_pawwer, 1, 1, 1,
    CURRENT_DATE, CURRENT_DATE, '08:00:00', '18:00:00',
    120000, 30000, 90000, now() + interval '1 hour',
    '[PRUEBA] Necesita su pastilla a las 8:00 am. Muy sociable con otros perros.',
    4.6975, -74.0405, 'Usaquén', 'Calle 116 # 15-45, Usaquén, Bogotá',
    2, 40000, 'pawwer'
  )
  RETURNING id INTO v_b1;
  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog1, v_b1);

  -- ── Solicitud 2: DayCare HOY, SIN transporte ──
  --   cuidado 80k = total 80k. comisión 20k → payout 60k.
  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, start_time, end_time,
    total, commission, pawwer_payout, phase_expires_at, comments,
    client_lat, client_lng, client_neighborhood, client_address,
    transport_legs, transport_fee, transport_provider
  ) VALUES (
    v_client, v_pawwer, 1, 1, 1,
    CURRENT_DATE, CURRENT_DATE, '09:00:00', '17:00:00',
    80000, 20000, 60000, now() + interval '1 hour',
    '[PRUEBA] Muy juguetón, le encanta correr en el parque.',
    4.6560, -74.0578, 'Chapinero', 'Carrera 7 # 72-30, Chapinero, Bogotá',
    0, 0, NULL
  )
  RETURNING id INTO v_b2;
  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog2, v_b2);

  RAISE NOTICE '✅ Dos cuidados creados: b1=% (con transporte) | b2=% (sin transporte) | pawwer=%', v_b1, v_b2, v_pawwer;
END $$;

-- ── Verificar bookings + dirección ──────────────────────────────────
SELECT b.id, b.status_id, b.start_time::text, b.end_time::text,
       b.client_neighborhood, b.client_address,
       b.transport_fee, b.pawwer_payout,
       d.name AS perro, d.breed, d.weight_kg
FROM   public.booking b
JOIN   public.dog_booking db ON db.booking_id = b.id
JOIN   public.dog d          ON d.id = db.dog_id
WHERE  b.comments LIKE '[PRUEBA]%'
ORDER  BY b.created_at DESC;

SELECT type, title, body, link, created_at
FROM   public.notifications
WHERE  user_id = '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8'
ORDER  BY created_at DESC
LIMIT  3;

-- ── (Opcional) Limpiar el test después: ────────────────────────────
-- DELETE FROM public.booking WHERE comments LIKE '[PRUEBA]%';
-- DELETE FROM public.dog     WHERE name IN ('Bimba', 'Rocco');
