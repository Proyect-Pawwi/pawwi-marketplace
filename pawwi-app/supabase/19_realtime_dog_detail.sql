-- ============================================================
-- PAWWI — Realtime para notificaciones + campos dog en detalle
-- Correr en Supabase SQL Editor después de 18_escalation.sql
-- ============================================================

-- ── 1. Realtime en booking_candidates ────────────────────────
ALTER TABLE public.booking_candidates REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_candidates;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ── 2. Realtime en booking ────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.booking;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ── 3. get_pawwer_booking_detail — incluye age y notes del perro ─
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
        'notes',     d.notes
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
