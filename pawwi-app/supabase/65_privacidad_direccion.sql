-- ============================================================
-- PAWWI — Fuga de privacidad: la dirección del cliente
-- Correr en Supabase SQL Editor después de 64_dos_etapas.sql
--
-- CÓMO SE ENCONTRÓ: al escribir la Política de Privacidad. La página publicada
-- afirmaba «Nunca mostramos tu dirección exacta a un Pawwer antes de que
-- aceptes una reserva», y al ir a verificarlo resultó ser FALSO.
--
-- EL PROBLEMA: get_pawwer_bookings y get_pawwer_booking_detail devuelven
-- client_address y las coordenadas exactas a cualquiera que sea PAWWER
-- ASIGNADO **o CANDIDATO**. Un candidato no ha aceptado nada — y en la etapa 2
-- (bolsa general) puede haber muchos candidatos a la vez, todos recibiendo la
-- dirección exacta de una casa que ninguno va a cuidar.
--
-- Y empeora con la migración 64: al quitar el piso de precio del filtro, la
-- bolsa alcanza a MÁS Pawwers. La fuga se amplía justo cuando la bolsa mejora.
--
-- LA CORRECCIÓN: la dirección exacta solo para el Pawwer asignado. Al candidato
-- se le da el barrio y unas coordenadas redondeadas a 2 decimales (~1,1 km):
-- suficiente para decidir si le queda lejos, inútil para llegar a la puerta.
--
-- No se toca ninguna columna: el dato sigue guardado igual. Lo que cambia es
-- quién lo puede leer, que es donde estaba el error.
-- ============================================================

BEGIN;

-- ── 1. get_pawwer_bookings — la lista de solicitudes ──────────
CREATE OR REPLACE FUNCTION public.get_pawwer_bookings(p_status_ids int[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id, 'start_date', b.start_date, 'end_date', b.end_date,
      'start_time', b.start_time, 'end_time', b.end_time,
      'total', b.total, 'pawwer_payout', b.pawwer_payout,
      'commission_rate', b.commission_rate,
      'paid_at', b.paid_at, 'accepted_at', b.accepted_at,
      'status_id', b.status_id, 'search_phase', b.search_phase,
      'phase_expires_at', b.phase_expires_at, 'created_at', b.created_at,
      -- PRIVACIDAD: la dirección exacta es solo para el Pawwer ASIGNADO. Un
      -- candidato de la bolsa aún no cuida a ese perro; con el barrio y unas
      -- coordenadas redondeadas a ~1 km le alcanza para estimar la distancia,
      -- y no le alcanza para encontrar la casa.
      'client_lat', CASE WHEN b.pawwer_id = auth.uid() THEN b.client_lat
                         ELSE round(b.client_lat::numeric, 2)::double precision END,
      'client_lng', CASE WHEN b.pawwer_id = auth.uid() THEN b.client_lng
                         ELSE round(b.client_lng::numeric, 2)::double precision END,
      'client_neighborhood', b.client_neighborhood,
      'client_address', CASE WHEN b.pawwer_id = auth.uid()
                             THEN b.client_address ELSE NULL END,
      -- transport_provider y transport_decided quedaron congeladas en la mig 60
      -- («no leer en código»). Se dejan de devolver para que no haya tentación.
      'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
      'service_type', st.name,
      'client', jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url),
      'dogs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', d.name, 'breed', d.breed, 'photo_url', d.photo_url, 'weight_kg', d.weight_kg,
          -- Comportamiento (mig 57). El Pawwer decide si acepta CON esto a la vista,
          -- no después. NULL = el dueño aún no lo declaró (el Pasaporte llega en S3).
          'friendly_dogs', d.friendly_dogs, 'separation_anxiety', d.separation_anxiety))
        FROM public.dog_booking db JOIN public.dog d ON d.id = db.dog_id
        WHERE db.booking_id = b.id), '[]'::jsonb)
    ) ORDER BY b.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p       ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.status_id = ANY(p_status_ids)
    AND (b.pawwer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.booking_candidates bc
                    WHERE bc.booking_id = b.id AND bc.pawwer_id = auth.uid()));
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pawwer_bookings(int[]) TO authenticated;

-- ── 2. get_pawwer_booking_detail — el detalle ────────────────
CREATE OR REPLACE FUNCTION public.get_pawwer_booking_detail(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', b.id, 'start_date', b.start_date, 'end_date', b.end_date,
    'start_time', b.start_time, 'end_time', b.end_time,
    'total', b.total, 'pawwer_payout', b.pawwer_payout,
    'commission_rate', b.commission_rate,
    'paid_at', b.paid_at, 'accepted_at', b.accepted_at,
    'status_id', b.status_id, 'search_phase', b.search_phase,
    'phase_expires_at', b.phase_expires_at, 'created_at', b.created_at,
    'comments', b.comments,
    -- PRIVACIDAD: la dirección exacta es solo para el Pawwer ASIGNADO. Un
    -- candidato de la bolsa aún no cuida a ese perro; con el barrio y unas
    -- coordenadas redondeadas a ~1 km le alcanza para estimar la distancia,
    -- y no le alcanza para encontrar la casa.
    'client_lat', CASE WHEN b.pawwer_id = auth.uid() THEN b.client_lat
                       ELSE round(b.client_lat::numeric, 2)::double precision END,
    'client_lng', CASE WHEN b.pawwer_id = auth.uid() THEN b.client_lng
                       ELSE round(b.client_lng::numeric, 2)::double precision END,
    'client_neighborhood', b.client_neighborhood,
    'client_address', CASE WHEN b.pawwer_id = auth.uid()
                           THEN b.client_address ELSE NULL END,
    'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
    'service_type', st.name,
    'client', jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url),
    'dogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', d.name, 'breed', d.breed, 'photo_url', d.photo_url,
        'age', d.age, 'notes', d.notes, 'weight_kg', d.weight_kg, 'sex', d.sex,
        'friendly_dogs', d.friendly_dogs, 'separation_anxiety', d.separation_anxiety,
        'energy_level', d.energy_level, 'medical_notes', d.medical_notes))
      FROM public.dog_booking db JOIN public.dog d ON d.id = db.dog_id
      WHERE db.booking_id = b.id), '[]'::jsonb),
    'review', (
      SELECT jsonb_build_object('rating', r.rating, 'comment', r.comment)
      FROM public.reviews r WHERE r.booking_id = b.id LIMIT 1)
  )
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p       ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.id = p_booking_id
    AND (b.pawwer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.booking_candidates bc
                    WHERE bc.booking_id = b.id AND bc.pawwer_id = auth.uid()));
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pawwer_booking_detail(uuid) TO authenticated;

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
--   select
--     (select count(*) from pg_proc
--      where proname='get_pawwer_bookings'
--        and pg_get_functiondef(oid) like '%pawwer_id = auth.uid() THEN b.client_address%') as lista_enmascara,
--     (select count(*) from pg_proc
--      where proname='get_pawwer_booking_detail'
--        and pg_get_functiondef(oid) like '%pawwer_id = auth.uid() THEN b.client_address%') as detalle_enmascara;
--   -- esperado: 1 · 1
