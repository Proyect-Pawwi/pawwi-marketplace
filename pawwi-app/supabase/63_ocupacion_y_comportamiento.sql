-- ============================================================
-- PAWWI — S1 · Ocupación real del día y comportamiento visible
-- Correr en Supabase SQL Editor después de 62_seed_availability_dev.sql
--
-- DOS COSAS QUE VAN JUNTAS:
--
-- 1) OCUPACIÓN REAL. «Acepta hasta 4 perros» no sirve para decidir; lo que el
--    cliente necesita saber es cuántos perros habrá EL DÍA que reserva:
--        «Sábado 14 · Tu perro sería 1 de 3 · Juliana acepta hasta 4»
--    Eso es capacidad − disponible, y la capacidad NO estaba guardada en
--    ninguna parte: la migración 61 dejó slots_remaining contando lo que
--    QUEDA, sin un sitio del que restar. Derivarla de max_animals funciona
--    hasta que el Pawwer cambia su tope, y entonces la resta miente.
--    Se guarda explícitamente en availability.slots_total.
--
-- 2) COMPORTAMIENTO VISIBLE. friendly_dogs y separation_anxiety existen desde
--    la migración 57 y no se leían en ninguna parte. Con capacidad > 1 dejan
--    de ser opcionales: el Pawwer tiene que verlos ANTES de aceptar, no
--    después de tener al perro en casa.
--    NULL significa «el dueño aún no lo declaró» — el formulario del Pasaporte
--    llega en S3, así que al principio casi todo será NULL, y eso se muestra
--    como «sin informar», nunca como «no».
-- ============================================================

BEGIN;

-- ── 1. Capacidad declarada del día ────────────────────────────
ALTER TABLE public.availability
  ADD COLUMN IF NOT EXISTS slots_total integer;

COMMENT ON COLUMN public.availability.slots_total IS
  'PERROS que el Pawwer acepta ese día en total (capacidad declarada). '
  'La ocupación real es slots_total - slots_remaining. Añadida en S1 porque '
  'sin ella la ocupación no se puede calcular sin adivinar la capacidad.';

-- Backfill: capacidad = lo que queda + lo ya comprometido ese día.
UPDATE public.availability a
SET slots_total = a.slots_remaining + COALESCE((
      SELECT COUNT(db.dog_id)
      FROM   public.booking b
      JOIN   public.dog_booking db ON db.booking_id = b.id
      WHERE  b.pawwer_id = a.pawwer_id
        AND  b.status_id IN (2, 3)
        AND  a.date BETWEEN b.start_date AND b.end_date
    ), 0)
WHERE a.slots_total IS NULL;

-- ── 2. upsert_availability mantiene las dos ───────────────────
-- El Pawwer fija la CAPACIDAD del día desde su calendario; lo disponible se
-- deriva restando lo ya comprometido. Antes solo escribía slots_remaining, y
-- fijar un día con reservas encima le devolvía cupo que no tenía.
CREATE OR REPLACE FUNCTION public.upsert_availability(
  p_pawwer_id uuid,
  p_date      date,
  p_slots     int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_committed int;
BEGIN
  IF auth.uid() != p_pawwer_id THEN
    RAISE EXCEPTION 'Solo el Pawwer puede gestionar su disponibilidad';
  END IF;
  IF p_slots < 0 THEN
    RAISE EXCEPTION 'Capacidad inválida';
  END IF;

  SELECT COALESCE(COUNT(db.dog_id), 0) INTO v_committed
  FROM   public.booking b
  JOIN   public.dog_booking db ON db.booking_id = b.id
  WHERE  b.pawwer_id = p_pawwer_id
    AND  b.status_id IN (2, 3)
    AND  p_date BETWEEN b.start_date AND b.end_date;

  INSERT INTO public.availability (pawwer_id, date, slots_total, slots_remaining)
  VALUES (p_pawwer_id, p_date, p_slots, GREATEST(0, p_slots - v_committed))
  ON CONFLICT (pawwer_id, date) DO UPDATE
  SET slots_total     = p_slots,
      slots_remaining = GREATEST(0, p_slots - v_committed);
END;
$$;
-- La 25 endureció esta función quitándosela a PUBLIC. CREATE OR REPLACE
-- conserva los privilegios, pero se repite para que quede explícito.
REVOKE ALL   ON FUNCTION public.upsert_availability(uuid, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_availability(uuid, date, int) TO authenticated;

-- ── 3. get_pawwer_bookings — comportamiento en la lista ───────
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
      'client_lat', b.client_lat, 'client_lng', b.client_lng,
      'client_neighborhood', b.client_neighborhood, 'client_address', b.client_address,
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

-- ── 4. get_pawwer_booking_detail — comportamiento en el detalle ─
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
    'client_lat', b.client_lat, 'client_lng', b.client_lng,
    'client_neighborhood', b.client_neighborhood, 'client_address', b.client_address,
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
--   select count(*) filter (where slots_total is null) as sin_capacidad,
--          count(*) filter (where slots_total < slots_remaining) as incoherentes,
--          min(slots_total) as cap_min, max(slots_total) as cap_max
--   from public.availability where date >= current_date;
--   -- esperado: 0 · 0 · 1 · 4
--
--   select pg_get_functiondef(oid) like '%friendly_dogs%' as expone_comportamiento
--   from pg_proc where proname = 'get_pawwer_bookings';
--   -- esperado: true
