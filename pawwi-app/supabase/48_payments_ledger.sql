-- ============================================================
-- PAWWI — Ledger de pagos real (paid_at) + accepted_at
-- Correr en Supabase SQL Editor después de 47_payout_summary.sql
--
-- Reemplaza la HEURÍSTICA de la pantalla Ganancias por estado REAL:
--   • booking.paid_at    → cuándo se le PAGÓ ese cuidado al pawwer. NULL = no
--     pagado. Ya no se adivina "pagado" por fecha; se marca de verdad cuando se
--     hace la transferencia (RPC mark_payouts_paid, abajo). La integración de
--     transferencia (Wompi/Bold) va aparte y luego llamará esa misma RPC.
--   • booking.accepted_at → cuándo el pawwer ACEPTÓ. Sirve para que "Cancelados"
--     en Ganancias solo muestre cuidados que realmente tomaste (no solicitudes
--     directas que el cliente canceló antes de que aceptaras).
--
-- Efecto en la UI:
--   Pendientes = completado (4) con paid_at IS NULL.
--   Pagados    = completado (4) con paid_at IS NOT NULL.
--   Próximo pago = Σ de lo completado sin pagar (lo que se te debe hoy).
-- ============================================================

-- ── 1. Columnas del ledger ────────────────────────────────────
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS paid_at     timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- ── 2. Backfill de accepted_at (datos históricos) ─────────────
-- No tenemos la hora real de aceptación anterior → usamos created_at como
-- aproximación. "Aceptado" = estados 2/3/4, o cancelados (5) que llegaron a
-- tener chat (el accept inserta el mensaje de sistema "¡Reserva confirmada!").
-- Los cancelados sin chat (solicitud directa cancelada antes de aceptar)
-- quedan con accepted_at NULL → no aparecen en "Cancelados".
UPDATE public.booking b
SET accepted_at = created_at
WHERE accepted_at IS NULL
  AND (b.status_id IN (2, 3, 4)
       OR (b.status_id = 5 AND EXISTS (SELECT 1 FROM public.messages m WHERE m.booking_id = b.id)));

-- paid_at se queda NULL a propósito: nada está pagado hasta que ocurra una
-- transferencia real y se llame mark_payouts_paid.

-- ── 3. accept_booking: sella accepted_at ──────────────────────
CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b       public.booking%ROWTYPE;
  v_days    int;
  v_updated int;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no disponible o ya fue tomada';
  END IF;

  -- Acceso: fase 1 (pawwer directo) o candidato fase 2/3
  IF v_b.pawwer_id IS DISTINCT FROM auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_candidates
      WHERE booking_id = p_booking_id AND pawwer_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a esta reserva';
    END IF;
  END IF;

  -- Bloquear la agenda: descontar cupo al aceptar (antes se hacía al crear).
  v_days := (v_b.end_date - v_b.start_date) + 1;

  PERFORM 1 FROM public.availability
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
  FOR UPDATE;

  UPDATE public.availability
  SET   slots_remaining = slots_remaining - 1
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
    AND slots_remaining > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated < v_days THEN
    RAISE EXCEPTION 'Ya no tienes cupo para estas fechas';
  END IF;

  UPDATE public.booking
  SET status_id   = 2,
      pawwer_id   = auth.uid(),
      accepted_at = now()
  WHERE id = p_booking_id;

  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;

  -- Mensaje predeterminado que abre el chat para ambos
  INSERT INTO public.messages (booking_id, sender_id, content, is_system)
  VALUES (p_booking_id, NULL,
          '¡Reserva confirmada! Coordinen aquí los detalles del cuidado. 🐾',
          true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;

-- ── 4. get_pawwer_payout_summary: por paid_at (no por fecha) ───
CREATE OR REPLACE FUNCTION public.get_pawwer_payout_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_today       date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_dow         int  := EXTRACT(DOW FROM v_today)::int;   -- 0=Dom … 5=Vie … 6=Sáb
  v_next_friday date := v_today + ((5 - v_dow + 7) % 7);  -- próximo viernes ≥ hoy
  v_result      jsonb;
BEGIN
  SELECT jsonb_build_object(
    'today',              v_today,
    'next_payout_date',   v_next_friday,
    -- Próximo pago = todo lo completado que aún no se ha pagado (lo que se te debe).
    'next_payout_amount', COALESCE(SUM(pawwer_payout) FILTER (WHERE status_id = 4 AND paid_at IS NULL), 0),
    'pending_count',      COALESCE(COUNT(*)           FILTER (WHERE status_id = 4 AND paid_at IS NULL), 0),
    'paid_total',         COALESCE(SUM(pawwer_payout) FILTER (WHERE status_id = 4 AND paid_at IS NOT NULL), 0),
    'lifetime_earnings',  COALESCE(SUM(pawwer_payout) FILTER (WHERE status_id = 4), 0)
  )
  INTO v_result
  FROM public.booking
  WHERE pawwer_id = v_uid;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pawwer_payout_summary() TO authenticated;

-- ── 5. Getters: devuelven paid_at + accepted_at (aditivo) ─────
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
      'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
      'transport_provider', b.transport_provider, 'transport_decided', b.transport_decided,
      'service_type', st.name,
      'client', jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url),
      'dogs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', d.name, 'breed', d.breed, 'photo_url', d.photo_url, 'weight_kg', d.weight_kg))
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

-- ── 6. mark_payouts_paid — SELLA el pago (marca manual/real) ──
-- La corre quien procesa la transferencia (admin/Luisa vía service_role, o el
-- futuro webhook de Wompi). NO es ejecutable por pawwers (no pueden marcarse
-- "pagados" a sí mismos). Marca lo completado y sin pagar:
--   • p_pawwer_id NULL → todos los pawwers (nómina completa).
--   • p_up_to     NULL → sin tope de fecha; si se da, solo end_date <= p_up_to.
-- Devuelve cuántos cuidados marcó.
CREATE OR REPLACE FUNCTION public.mark_payouts_paid(
  p_pawwer_id uuid DEFAULT NULL,
  p_up_to     date DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.booking
  SET    paid_at = now()
  WHERE  status_id = 4
    AND  paid_at IS NULL
    AND  (p_pawwer_id IS NULL OR pawwer_id = p_pawwer_id)
    AND  (p_up_to     IS NULL OR end_date <= p_up_to);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_payouts_paid(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_payouts_paid(uuid, date) TO service_role;

-- Prueba (SQL Editor como owner): marcar como pagado lo tuyo hasta hoy →
--   SELECT public.mark_payouts_paid('<tu_pawwer_uuid>', CURRENT_DATE);
