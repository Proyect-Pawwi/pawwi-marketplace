-- ============================================================
-- PAWWI — Peso/sexo del perro + horarios de booking
-- Correr en Supabase SQL Editor después de 19_realtime_dog_detail.sql
-- ============================================================

-- ── 1. Nuevos campos en dog ───────────────────────────────────
ALTER TABLE public.dog
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,1),
  ADD COLUMN IF NOT EXISTS sex       text CHECK (sex IN ('macho', 'hembra'));

-- ── 2. Horarios de servicio en booking ───────────────────────
-- Opcionales: solo aplican para DayCare / Express (mismo día)
-- Travel / NightCare usan solo fechas
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time   time;

-- ── 3. get_pawwer_booking_detail — incluye nuevos campos ─────
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
    'id',               b.id,
    'start_date',       b.start_date,
    'end_date',         b.end_date,
    'start_time',       b.start_time,
    'end_time',         b.end_time,
    'total',            b.total,
    'pawwer_payout',    b.pawwer_payout,
    'status_id',        b.status_id,
    'search_phase',     b.search_phase,
    'phase_expires_at', b.phase_expires_at,
    'created_at',       b.created_at,
    'comments',         b.comments,
    'service_type',     st.name,
    'client', jsonb_build_object(
      'id',         p.id,
      'name',       p.name,
      'avatar_url', p.avatar_url
    ),
    'dogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name',      d.name,
        'breed',     d.breed,
        'photo_url', d.photo_url,
        'age',       d.age,
        'notes',     d.notes,
        'weight_kg', d.weight_kg,
        'sex',       d.sex
      ))
      FROM  public.dog_booking db
      JOIN  public.dog d ON d.id = db.dog_id
      WHERE db.booking_id = b.id
    ), '[]'::jsonb),
    'review', (
      SELECT jsonb_build_object('rating', r.rating, 'comment', r.comment)
      FROM  public.reviews r
      WHERE r.booking_id = b.id
      LIMIT 1
    )
  )
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p       ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.id = p_booking_id
    AND (
      b.pawwer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.booking_candidates bc
        WHERE bc.booking_id = b.id AND bc.pawwer_id = auth.uid()
      )
    );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_booking_detail(uuid) TO authenticated;
