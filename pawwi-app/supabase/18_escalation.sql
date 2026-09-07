-- ============================================================
-- PAWWI — Sistema de escalación de solicitudes de booking
-- Correr en Supabase SQL Editor después de 17_chart_data.sql
-- ============================================================

-- ── 1. Nuevo estado: sin cuidador ─────────────────────────────
INSERT INTO public.booking_status (id, name)
VALUES (6, 'sin_cuidador')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Columnas de escalación en booking ──────────────────────
-- search_phase: 1=directo, 2=búsqueda relacionada, 3=toda la ciudad
-- phase_expires_at: cuándo vence el timer de la fase actual
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS search_phase     smallint     NOT NULL DEFAULT 1
    CHECK (search_phase IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS phase_expires_at timestamptz;

-- ── 3. Tabla booking_candidates ───────────────────────────────
-- Un booking puede tener múltiples candidatos en fases 2/3.
-- "Primero en aceptar gana" — la fila en booking queda asignada
-- al primer pawwer que llama accept_booking con éxito.
CREATE TABLE IF NOT EXISTS public.booking_candidates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid        NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  pawwer_id   uuid        NOT NULL REFERENCES public.pawwer(id),
  phase       smallint    NOT NULL CHECK (phase IN (1, 2, 3)),
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, pawwer_id)
);

ALTER TABLE public.booking_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidate_own_select" ON public.booking_candidates;
CREATE POLICY "candidate_own_select" ON public.booking_candidates
  FOR SELECT USING (pawwer_id = auth.uid());

-- ── 4. Índice para el Edge Function (escanea expirados) ───────
CREATE INDEX IF NOT EXISTS idx_booking_escalation
  ON public.booking (phase_expires_at, search_phase, status_id)
  WHERE status_id = 1;

-- ── 5. find_escalation_candidates ────────────────────────────
-- Devuelve pawwer_ids elegibles para un booking en fase 2 o 3.
-- Fase 2: mismo servicio, precio ±20%, slots disponibles.
-- Fase 3: mismo servicio, cualquier precio, slots disponibles.
-- Excluye al pawwer original y a quien ya es candidato.
CREATE OR REPLACE FUNCTION public.find_escalation_candidates(
  p_booking_id uuid,
  p_phase      int   -- 2 o 3
)
RETURNS TABLE(pawwer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_service_type_id int;
  v_original_pawwer uuid;
  v_pawwer_payout   numeric;
  v_start_date      date;
  v_end_date        date;
  v_days            int;
  v_min_rate        numeric;
  v_max_rate        numeric;
BEGIN
  SELECT b.service_type_id, b.pawwer_id, b.pawwer_payout,
         b.start_date, b.end_date
  INTO   v_service_type_id, v_original_pawwer, v_pawwer_payout,
         v_start_date, v_end_date
  FROM   public.booking b
  WHERE  b.id = p_booking_id;

  v_days     := GREATEST(1, v_end_date - v_start_date);
  v_min_rate := (v_pawwer_payout / v_days) * 0.80;
  v_max_rate := (v_pawwer_payout / v_days) * 1.20;

  RETURN QUERY
  SELECT DISTINCT sxp.id_pawwer
  FROM   public."service_X_Pawwer" sxp
  JOIN   public.pawwer pw ON pw.id = sxp.id_pawwer
  WHERE  sxp.id_service = v_service_type_id
    AND  sxp.is_active  = true
    AND  pw.status      = 'approved'
    -- Excluir al pawwer original del booking
    AND  sxp.id_pawwer != COALESCE(v_original_pawwer, '00000000-0000-0000-0000-000000000000'::uuid)
    -- Fase 2: precio dentro de ±20%; Fase 3: cualquier precio
    AND  (p_phase = 3 OR sxp.price BETWEEN v_min_rate AND v_max_rate)
    -- Slots disponibles en TODAS las fechas del rango
    AND  NOT EXISTS (
           SELECT 1
           FROM   (
             SELECT (v_start_date + gs.i)::date AS d
             FROM   generate_series(0, v_end_date - v_start_date) AS gs(i)
           ) dates
           WHERE  NOT EXISTS (
             SELECT 1
             FROM   public.availability a
             WHERE  a.pawwer_id       = sxp.id_pawwer
               AND  a.date            = dates.d
               AND  a.slots_remaining > 0
           )
         )
    -- No es ya candidato para este booking
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.booking_candidates bc
           WHERE  bc.booking_id = p_booking_id
             AND  bc.pawwer_id  = sxp.id_pawwer
         );
END;
$$;

-- ── 6. accept_booking — actualizado ───────────────────────────
-- Valida que el pawwer sea elegible: fase 1 (directo) o
-- candidato en fases 2/3. Atomic con FOR UPDATE.
CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.booking%ROWTYPE;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no disponible o ya fue tomada';
  END IF;

  -- Verificar acceso: fase 1 (pawwer directo) o candidato fase 2/3
  IF v_b.pawwer_id IS DISTINCT FROM auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_candidates
      WHERE booking_id = p_booking_id AND pawwer_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a esta reserva';
    END IF;
  END IF;

  UPDATE public.booking
  SET status_id = 2,
      pawwer_id = auth.uid()   -- asignar aceptante (clave en fases 2/3)
  WHERE id = p_booking_id;

  -- Limpiar candidatos restantes (ya no aplica)
  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;

-- ── 7. decline_solicitud — rechazar en cualquier fase ─────────
-- Fase 1: restaura slots + escala a fase 2 inmediatamente.
-- Fases 2/3: solo elimina la candidatura de este pawwer.
CREATE OR REPLACE FUNCTION public.decline_solicitud(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.booking%ROWTYPE;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no disponible';
  END IF;

  -- ── Fase 1: este es el pawwer elegido directamente ──────────
  IF v_b.search_phase = 1 AND v_b.pawwer_id = auth.uid() THEN
    -- Devolver slots de disponibilidad
    UPDATE public.availability
    SET   slots_remaining = slots_remaining + 1
    WHERE pawwer_id = auth.uid()
      AND date BETWEEN v_b.start_date AND v_b.end_date;

    -- Escalar a fase 2 de inmediato (no esperar el timer)
    UPDATE public.booking
    SET search_phase     = 2,
        phase_expires_at = now() + INTERVAL '6 hours'
    WHERE id = p_booking_id;

    -- Insertar candidatos fase 2 ahora mismo
    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT p_booking_id, cand.pawwer_id, 2
    FROM   public.find_escalation_candidates(p_booking_id, 2) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;

    RETURN;
  END IF;

  -- ── Fases 2/3: eliminar solo esta candidatura ────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.booking_candidates
    WHERE booking_id = p_booking_id AND pawwer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No eres candidato para esta reserva';
  END IF;

  DELETE FROM public.booking_candidates
  WHERE booking_id = p_booking_id AND pawwer_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_solicitud(uuid) TO authenticated;

-- ── 8. get_pawwer_bookings — incluye candidaturas ─────────────
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
      'id',               b.id,
      'start_date',       b.start_date,
      'end_date',         b.end_date,
      'total',            b.total,
      'pawwer_payout',    b.pawwer_payout,
      'status_id',        b.status_id,
      'search_phase',     b.search_phase,
      'phase_expires_at', b.phase_expires_at,
      'created_at',       b.created_at,
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
          'photo_url', d.photo_url
        ))
        FROM  public.dog_booking db
        JOIN  public.dog d ON d.id = db.dog_id
        WHERE db.booking_id = b.id
      ), '[]'::jsonb)
    )
    ORDER BY b.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM  public.booking b
  JOIN  public.profile p       ON p.id  = b.client_id
  JOIN  public.service_type st ON st.id = b.service_type_id
  WHERE b.status_id = ANY(p_status_ids)
    AND (
      -- Fase 1: elegido directamente
      b.pawwer_id = auth.uid()
      OR
      -- Fases 2/3: candidato notificado
      EXISTS (
        SELECT 1 FROM public.booking_candidates bc
        WHERE bc.booking_id = b.id AND bc.pawwer_id = auth.uid()
      )
    );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_bookings(int[]) TO authenticated;

-- ── 9. get_pawwer_booking_detail — incluye candidaturas ───────
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
        'photo_url', d.photo_url
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
