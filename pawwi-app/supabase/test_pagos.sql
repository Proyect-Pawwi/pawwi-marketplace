-- ============================================================
-- TEST — Pagos pendientes / ledger (pantalla Ganancias)
-- Pawwer de prueba: 2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8
-- Requisitos: haber corrido hasta la 48.
--
-- Siembra 6 cuidados marcados '[PAGO]':
--   • 3 COMPLETADOS sin pagar (paid_at NULL)     → Pendientes / próximo pago
--   • 1 COMPLETADO ya pagado  (paid_at fijado)   → Pagados
--   • 1 CANCELADO aceptado    (accepted_at ✓)    → aparece en Cancelados
--   • 1 CANCELADO no aceptado (accepted_at NULL) → NO aparece en Cancelados
--
-- El run por defecto DEJA los 3 pendientes vivos para verlos en
-- /pawwer/ingresos. Para probar el pago automático (marcar → Pagados), corre
-- aparte el bloque OPCIONAL del final. Re-ejecutable. NO se auto-borra.
-- ============================================================

-- ── Limpieza previa (re-ejecutable) ──────────────────────────
DELETE FROM public.messages    WHERE booking_id IN (SELECT id FROM public.booking WHERE comments LIKE '[PAGO]%');
DELETE FROM public.dog_booking WHERE booking_id IN (SELECT id FROM public.booking WHERE comments LIKE '[PAGO]%');
DELETE FROM public.booking     WHERE comments LIKE '[PAGO]%';
DELETE FROM public.dog         WHERE breed = 'TestPago';

-- ── Helper temporal: siembra un cuidado + su perro ───────────
CREATE OR REPLACE FUNCTION pg_temp.seed_pago(
  p_name text, p_svc int, p_status int, p_start date, p_end date,
  p_payout int, p_paid timestamptz, p_accepted timestamptz, p_tag text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_pawwer uuid := '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8';
  v_client uuid;
  v_dog    uuid;
  v_bk     uuid;
  v_comm   int := round(p_payout / 3.0);   -- comisión ≈ 25% del total (payout = 75%)
BEGIN
  SELECT c.id INTO v_client FROM public.client c WHERE c.id <> v_pawwer ORDER BY c.id LIMIT 1;
  IF v_client IS NULL THEN RAISE EXCEPTION 'No hay clientes de prueba'; END IF;

  INSERT INTO public.dog (owner_id, name, breed, size, age, weight_kg, sex)
  VALUES (v_client, p_name, 'TestPago', 2, 3, 12.0, 'hembra') RETURNING id INTO v_dog;

  INSERT INTO public.booking (
    client_id, pawwer_id, service_type_id, status_id, search_phase,
    start_date, end_date, start_time, end_time,
    total, commission, pawwer_payout, comments,
    client_lat, client_lng, client_neighborhood, client_address,
    paid_at, accepted_at
  ) VALUES (
    v_client, v_pawwer, p_svc, p_status, 1,
    p_start, p_end, '08:00', '18:00',
    p_payout + v_comm, v_comm, p_payout, '[PAGO] ' || p_tag,
    4.6975, -74.0405, 'Usaquén', 'Calle 116 # 15-45, Usaquén, Bogotá',
    p_paid, p_accepted
  ) RETURNING id INTO v_bk;

  INSERT INTO public.dog_booking (dog_id, booking_id) VALUES (v_dog, v_bk);
END;
$$;

-- ── Sembrar los 6 cuidados ───────────────────────────────────
-- 3 completados SIN pagar → Pendientes (próximo pago = 60k+112.5k+90k = 262.500)
SELECT pg_temp.seed_pago('Firulais', 1, 4, CURRENT_DATE - 2, CURRENT_DATE - 2,  60000, NULL, now() - interval '2 day', 'Pendiente DayCare');
SELECT pg_temp.seed_pago('Rocky',    2, 4, CURRENT_DATE - 4, CURRENT_DATE - 3, 112500, NULL, now() - interval '4 day', 'Pendiente NightCare');
SELECT pg_temp.seed_pago('Bella',    3, 4, CURRENT_DATE - 6, CURRENT_DATE - 6,  90000, NULL, now() - interval '6 day', 'Pendiente Travel');
-- 1 completado YA pagado → Pagados
SELECT pg_temp.seed_pago('Coco',     1, 4, CURRENT_DATE - 12, CURRENT_DATE - 12, 75000, now() - interval '3 day', now() - interval '12 day', 'Pagado');
-- 1 cancelado ACEPTADO → aparece en Cancelados
SELECT pg_temp.seed_pago('Duna',     1, 5, CURRENT_DATE - 5, CURRENT_DATE - 5,  60000, NULL, now() - interval '5 day', 'Cancelado aceptado');
-- 1 cancelado NO aceptado (cancelado antes de aceptar) → NO en Cancelados
SELECT pg_temp.seed_pago('Zeus',     1, 5, CURRENT_DATE - 5, CURRENT_DATE - 5,  50000, NULL, NULL, 'Cancelado sin aceptar');

-- ── Impersonar al pawwer para las RPCs (leen auth.uid()) ─────
SELECT set_config('request.jwt.claims',
  json_build_object('sub','2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8','role','authenticated')::text, true);

-- Detalle de completados: cuáles están pagados y cuáles no
SELECT b.comments, b.pawwer_payout, (b.paid_at IS NOT NULL) AS pagado
FROM   public.booking b
WHERE  b.comments LIKE '[PAGO]%' AND b.status_id = 4
ORDER  BY pagado, b.pawwer_payout;

-- Cancelados: solo el que tiene accepted_at aparece en la UI (item #4)
SELECT b.comments, (b.accepted_at IS NOT NULL) AS aparece_en_cancelados
FROM   public.booking b
WHERE  b.comments LIKE '[PAGO]%' AND b.status_id = 5
ORDER  BY aparece_en_cancelados DESC;

-- ── RESUMEN (headline — el último SELECT es el que muestra el editor) ──
--   esperado: pendientes=3 · por_pagar=262500 · ya_pagado=75000 · total=337500
SELECT 'ANTES de pagar' AS momento,
       (s->>'pending_count')      AS pendientes,
       (s->>'next_payout_amount') AS por_pagar,
       (s->>'paid_total')         AS ya_pagado,
       (s->>'lifetime_earnings')  AS total_historico,
       (s->>'next_payout_date')   AS proximo_viernes
FROM  (SELECT public.get_pawwer_payout_summary() AS s) x;

-- ════════════════════════════════════════════════════════════
-- BLOQUE OPCIONAL — probar el pago automático (Pendientes → Pagados)
-- DESCOMENTA las líneas de abajo y córrelas (deja los pendientes en 0).
-- Es lo que haría Luisa / el webhook de Wompi al hacer la transferencia.
-- ════════════════════════════════════════════════════════════
-- SELECT public.mark_payouts_paid(
--   '2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8'::uuid, CURRENT_DATE
-- ) AS cuidados_marcados_pagados;   -- esperado: 3
-- SELECT set_config('request.jwt.claims',
--   json_build_object('sub','2dc6b8eb-5fd5-4b00-a8c5-b9ea942a6db8','role','authenticated')::text, true);
-- SELECT (s->>'pending_count') AS pendientes, (s->>'paid_total') AS ya_pagado
-- FROM (SELECT public.get_pawwer_payout_summary() AS s) x;   -- esperado: 0 · 337500

-- ── (Opcional) Limpiar después: ─────────────────────────────
-- DELETE FROM public.dog_booking WHERE booking_id IN (SELECT id FROM public.booking WHERE comments LIKE '[PAGO]%');
-- DELETE FROM public.booking WHERE comments LIKE '[PAGO]%';
-- DELETE FROM public.dog     WHERE breed = 'TestPago';
