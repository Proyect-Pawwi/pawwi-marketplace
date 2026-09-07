-- ============================================================
-- PAWWI — Bloquear la decisión de transporte
-- Correr en Supabase SQL Editor después de 30_chat_system_message.sql
--
-- Una vez el pawwer elige quién hace el transporte (en el popup tras
-- aceptar), la decisión es FINAL: transport_decided pasa a true y el
-- front oculta el toggle.
-- ============================================================

-- ── 1. Flag de decisión ───────────────────────────────────────
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS transport_decided boolean NOT NULL DEFAULT false;

-- ── 2. set_transport_provider — marca la decisión como final ──
CREATE OR REPLACE FUNCTION public.set_transport_provider(
  p_booking_id uuid,
  p_provider   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b          public.booking%ROWTYPE;
  v_cuidado    numeric;
  v_commission numeric;
BEGIN
  IF p_provider NOT IN ('pawwer','pawwi') THEN
    RAISE EXCEPTION 'Proveedor inválido';
  END IF;

  SELECT * INTO v_b FROM public.booking
  WHERE id = p_booking_id AND pawwer_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;
  IF v_b.status_id NOT IN (2,3) THEN
    RAISE EXCEPTION 'Solo puedes elegir el transporte en un cuidado confirmado o en curso';
  END IF;
  IF v_b.transport_fee <= 0 THEN
    RAISE EXCEPTION 'Este cuidado no incluye transporte';
  END IF;
  IF v_b.transport_decided THEN
    RAISE EXCEPTION 'La decisión de transporte ya fue tomada';
  END IF;

  v_cuidado := v_b.total - v_b.transport_fee;
  v_commission := ROUND(v_cuidado * 0.25, 0)
                + CASE WHEN p_provider = 'pawwer'
                       THEN ROUND(v_b.transport_fee * 0.25, 0)
                       ELSE v_b.transport_fee END;

  UPDATE public.booking
  SET transport_provider = p_provider,
      transport_decided  = true,
      commission         = v_commission,
      pawwer_payout      = v_b.total - v_commission
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_transport_provider(uuid, text) TO authenticated;

-- ── 3. get_pawwer_booking_detail — devuelve transport_decided ─
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
    'status_id', b.status_id, 'search_phase', b.search_phase,
    'phase_expires_at', b.phase_expires_at, 'created_at', b.created_at,
    'comments', b.comments,
    'client_lat', b.client_lat, 'client_lng', b.client_lng,
    'client_neighborhood', b.client_neighborhood,
    'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
    'transport_provider', b.transport_provider, 'transport_decided', b.transport_decided,
    'service_type', st.name,
    'client', jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url),
    'dogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', d.name, 'breed', d.breed, 'photo_url', d.photo_url,
        'age', d.age, 'notes', d.notes, 'weight_kg', d.weight_kg, 'sex', d.sex))
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
