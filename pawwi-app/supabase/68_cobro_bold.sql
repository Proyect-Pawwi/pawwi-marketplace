-- ============================================================
-- PAWWI — S2 · El dinero: el cobro al cliente por Bold
-- Correr en Supabase SQL Editor después de 67_limpiar_firmas_huerfanas.sql
--
-- ── LA SECUENCIA ──────────────────────────────────────────────
-- No se cobra nada hasta que las dos partes aceptaron (decidido el 2026-09-09):
--
--   El cliente reserva          → sin dinero, sin cupo bloqueado      status 1
--   El Pawwer acepta            → se bloquea el cupo; 2 h para pagar   status 2 · charged_at NULL
--   El cliente paga             → CONFIRMADA, se abre el chat          status 2 · charged_at
--   No paga (2 h + 20 min)      → vence y se libera el cupo            status 5 · cancelled_by 'system'
--
-- ── ⚠️ paid_at NO es el pago del cliente ───────────────────────
-- Desde la mig 48, booking.paid_at es cuándo Pawwi le TRANSFIRIÓ al Pawwer su
-- parte: lo leen Ganancias y mark_payouts_paid. El plan de S2 decía «el webhook
-- sella paid_at» — habría marcado como pagado al Pawwer dinero que nunca se le
-- transfirió, y la liquidación del viernes habría salido en cero. El cobro al
-- cliente va en su propia columna: charged_at.
--
-- ── DECISIONES DE NICOLÁS (2026-09-11) ────────────────────────
--   • 2 horas para pagar tras la aceptación, nunca más allá del inicio
--   • Si el cliente cancela algo YA pagado: 100% de reembolso si faltan 48 h
--     o más; con menos, no hay reembolso y el Pawwer cobra su parte
--   • El Pawwer ve la dirección exacta del cliente cuando el cliente PAGA
--   • La comisión es la del Pawwer que ACEPTA, y se congela en ese momento
--
-- ── BUGS HEREDADOS QUE SE CORRIGEN AQUÍ ───────────────────────
--   • advance_booking_statuses mandaba a la bolsa sin mirar allow_pool
--   • el Pawwer elegido veía la dirección exacta ANTES de aceptar: la mig 65
--     solo tapó a los candidatos, y en la etapa 1 pawwer_id viene desde la creación
--   • el techo de precio de la bolsa comparaba el neto del Pawwer contra la
--     tarifa de lista, y en Express una tarifa por hora contra el total
--   • la bolsa no exigía transporte ni respetaba el tope de perros del candidato
--   • un candidato de la bolsa veía su ganancia con la tasa del Pawwer elegido
--   • delete_availability: SECURITY DEFINER sin search_path desde la mig 06
--
-- ── LO QUE ESTO NO HACE ───────────────────────────────────────
-- Los reembolsos NO se ejecutan solos: Bold no tiene API de devoluciones y solo
-- anula tarjetas de crédito el mismo día antes de las 9 p. m. Aquí se ANOTAN
-- (booking_payment.refund_amount) y el admin los ejecuta a mano; la cola de
-- reembolsos pendientes se construye en S3, en /admin.
-- ============================================================

BEGIN;

-- ── 1. Columnas de la reserva ─────────────────────────────────
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS charged_at     timestamptz,
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_cancel    boolean NOT NULL DEFAULT false;

-- Una sola fuente de verdad para «esto se le debe al Pawwer»: el cuidado
-- completado, o la cancelación tardía del cliente (con menos de 48 h). La leen
-- Ganancias, el resumen de pagos, las gráficas y mark_payouts_paid.
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS pawwer_earns boolean
  GENERATED ALWAYS AS (
    COALESCE(status_id, 0) = 4 OR (COALESCE(status_id, 0) = 5 AND late_cancel)
  ) STORED;

COMMENT ON COLUMN public.booking.paid_at IS
  'Cuándo Pawwi le TRANSFIRIÓ al Pawwer su parte (liquidación de los viernes, mark_payouts_paid). NO es el pago del cliente: ese es charged_at.';
COMMENT ON COLUMN public.booking.charged_at IS
  'Cuándo Bold confirmó el pago del CLIENTE. NULL = no ha pagado.';
COMMENT ON COLUMN public.booking.payment_due_at IS
  'Hasta cuándo puede pagar el cliente tras la aceptación. NULL = reserva anterior a S2, que no pasó por la pasarela.';
COMMENT ON COLUMN public.booking.late_cancel IS
  'El cliente canceló una reserva pagada con menos de 48 h: no hay reembolso y el Pawwer cobra su parte.';

-- ── 2. Intentos de pago ───────────────────────────────────────
-- Un intento = una orden en Bold. Se abre uno nuevo solo tras un rechazo o un
-- fallo; mientras tanto se reutiliza el mismo order_id, para que el cliente no
-- pueda pagar dos veces la misma reserva desde dos pestañas.
CREATE TABLE IF NOT EXISTS public.booking_payment (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid        NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  -- Lo que se le manda a Bold: alfanumérico, guiones, hasta 60 caracteres
  order_id        text        NOT NULL UNIQUE CHECK (order_id ~ '^[A-Za-z0-9_-]{1,60}$'),
  amount          numeric     NOT NULL CHECK (amount > 0),
  status          text        NOT NULL DEFAULT 'abierto'
                  CHECK (status IN ('abierto','procesando','aprobado','rechazado','fallido','anulado')),
  -- data.payment_id de Bold: la llave de idempotencia del webhook
  bold_payment_id text        UNIQUE,
  payment_method  text,
  -- Qué hizo este pago con la reserva, si fue aprobado
  outcome         text        CHECK (outcome IN ('confirmo','duplicado','tardio','monto_distinto')),
  -- El reembolso se ANOTA aquí y se ejecuta a mano (ver el encabezado)
  refund_amount   numeric     CHECK (refund_amount IS NULL OR refund_amount >= 0),
  refund_reason   text,
  refunded_at     timestamptz,
  raw             jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_payment_booking_idx
  ON public.booking_payment (booking_id, created_at DESC);

-- Sin policies: nadie la lee ni la escribe directo, solo por las RPC de abajo.
ALTER TABLE public.booking_payment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_payment FROM anon, authenticated;

-- ── 3. accept_booking: aceptar ya no es confirmar ─────────────
-- Cambia el tipo de retorno (void → jsonb), y eso no se puede con CREATE OR
-- REPLACE: hay que eliminarla. Misma lista de parámetros, así que no queda
-- ninguna sobrecarga viva.
DROP FUNCTION IF EXISTS public.accept_booking(uuid);

CREATE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b          public.booking%ROWTYPE;
  v_days       int;
  v_updated    int;
  v_n_dogs     int;
  v_rate       numeric;
  v_commission numeric;
  v_start      timestamptz;
  v_due        timestamptz;
  v_name       text;
  v_avatar     text;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND status_id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no disponible o ya fue tomada';
  END IF;

  -- Acceso: el Pawwer elegido (etapa 1) o un candidato de la bolsa (etapa 2)
  IF v_b.pawwer_id IS DISTINCT FROM auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_candidates
      WHERE booking_id = p_booking_id AND pawwer_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a esta reserva';
    END IF;
  END IF;

  -- El cupo se bloquea al ACEPTAR y se mide en perros (mig 61). Si el cliente no
  -- paga a tiempo, run_booking_cron lo devuelve.
  v_days := (v_b.end_date - v_b.start_date) + 1;

  SELECT COUNT(*) INTO v_n_dogs
  FROM   public.dog_booking WHERE booking_id = p_booking_id;
  IF v_n_dogs < 1 THEN
    RAISE EXCEPTION 'La reserva no tiene mascotas asociadas';
  END IF;

  PERFORM 1 FROM public.availability
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
  FOR UPDATE;

  UPDATE public.availability
  SET   slots_remaining = slots_remaining - v_n_dogs
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date
    AND slots_remaining >= v_n_dogs;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated < v_days THEN
    RAISE EXCEPTION 'Ya no tienes cupo para estas fechas';
  END IF;

  -- La comisión es la del Pawwer que ACEPTA, y se congela aquí. Antes se
  -- congelaba al crear con el nivel del Pawwer ELEGIDO: si la tomaba otro desde
  -- la bolsa, heredaba una tasa ajena — cobraba como Ranger sin serlo, o perdía
  -- su 80% por tomar la reserva de alguien Nuevo. El cliente no nota nada: el
  -- total quedó fijo al crear, y todavía no ha pagado.
  v_rate := CASE WHEN public.compute_pawwer_level(auth.uid()) = 'ranger'
                 THEN 0.20 ELSE 0.25 END;
  v_commission := ROUND((v_b.total - COALESCE(v_b.transport_fee, 0)) * v_rate, 0)
                + ROUND(COALESCE(v_b.transport_fee, 0) * v_rate, 0);

  -- Dos horas para pagar, sin pasar del inicio del servicio — con un mínimo de
  -- 15 minutos, para que una reserva que empieza ya no nazca vencida.
  v_start := (v_b.start_date + COALESCE(v_b.start_time, TIME '00:00')) AT TIME ZONE 'America/Bogota';
  v_due   := LEAST(now() + INTERVAL '2 hours',
                   GREATEST(v_start, now() + INTERVAL '15 minutes'));

  UPDATE public.booking
  SET status_id       = 2,
      pawwer_id       = auth.uid(),
      accepted_at     = now(),
      commission_rate = v_rate,
      commission      = v_commission,
      pawwer_payout   = v_b.total - v_commission,
      payment_due_at  = v_due
  WHERE id = p_booking_id;

  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;

  -- El chat NO se abre aquí: se abre cuando el cliente paga
  -- (record_booking_payment). Antes de pagar no hay reserva firme.

  SELECT name, avatar_url INTO v_name, v_avatar
  FROM   public.profile WHERE id = auth.uid();

  INSERT INTO public.notifications
    (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
  VALUES
    (v_b.client_id, 'pago',
     COALESCE(v_name, 'Tu Pawwer') || ' aceptó tu reserva',
     'Paga antes de las ' || to_char(v_due AT TIME ZONE 'America/Bogota', 'HH24:MI')
       || ' para confirmarla. Hasta que pagues, no está confirmada.',
     p_booking_id, v_name, v_avatar, '/booking/confirmada/' || p_booking_id);

  RETURN jsonb_build_object(
    'booking_id',     p_booking_id,
    'client_id',      v_b.client_id,
    'payment_due_at', v_due,
    'total',          v_b.total
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.accept_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;

-- ── 4. start_booking_payment: el cliente abre el pago ─────────
-- Devuelve la orden que el servidor firma para Bold. La firma NO se calcula
-- aquí: necesita la llave secreta, que vive solo en el servidor de Next.
CREATE OR REPLACE FUNCTION public.start_booking_payment(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.booking%ROWTYPE;
  v_p public.booking_payment%ROWTYPE;
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND client_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;
  IF v_b.charged_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta reserva ya está pagada';
  END IF;
  IF v_b.status_id <> 2 OR v_b.payment_due_at IS NULL THEN
    RAISE EXCEPTION 'Esta reserva no está esperando un pago';
  END IF;
  IF v_b.payment_due_at <= now() THEN
    RAISE EXCEPTION 'Se venció el plazo para pagar esta reserva';
  END IF;

  -- Se reutiliza el intento abierto o en proceso: misma orden, misma firma.
  SELECT * INTO v_p
  FROM   public.booking_payment
  WHERE  booking_id = p_booking_id AND status IN ('abierto', 'procesando')
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    SELECT COUNT(*) INTO v_n
    FROM   public.booking_payment WHERE booking_id = p_booking_id;

    INSERT INTO public.booking_payment (booking_id, order_id, amount)
    VALUES (p_booking_id,
            'pw-' || replace(p_booking_id::text, '-', '') || '-' || (v_n + 1),
            ROUND(v_b.total, 0))
    RETURNING * INTO v_p;
  END IF;

  RETURN jsonb_build_object(
    'order_id',       v_p.order_id,
    'amount',         v_p.amount,
    'status',         v_p.status,
    'payment_due_at', v_b.payment_due_at
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.start_booking_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_booking_payment(uuid) TO authenticated;

-- ── 5. get_booking_payment_status: lo que el cliente ve del pago ─
CREATE OR REPLACE FUNCTION public.get_booking_payment_status(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_latest public.booking_payment%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id = p_booking_id AND client_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  SELECT * INTO v_latest
  FROM   public.booking_payment
  WHERE  booking_id = p_booking_id
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN NULL;   -- nunca intentó pagar
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_latest.order_id,
    'status',   v_latest.status,
    'refund_pending', (
      SELECT COALESCE(SUM(refund_amount), 0) FROM public.booking_payment
      WHERE booking_id = p_booking_id AND refund_amount > 0 AND refunded_at IS NULL),
    'refund_done', (
      SELECT COALESCE(SUM(refund_amount), 0) FROM public.booking_payment
      WHERE booking_id = p_booking_id AND refund_amount > 0 AND refunded_at IS NOT NULL)
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.get_booking_payment_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_payment_status(uuid) TO authenticated;

-- ── 6. record_booking_payment: el sello, solo del servidor ────
-- La llaman el webhook de Bold y la verificación al volver del checkout, las
-- dos con el estado que reporta BOLD (servidor a servidor), nunca con lo que
-- diga el navegador. Por eso es solo de service_role: si el cliente pudiera
-- llamarla, se daría la reserva por pagada — el mismo agujero del hotfix.
CREATE OR REPLACE FUNCTION public.record_booking_payment(
  p_order_id        text,
  p_bold_status     text,              -- APPROVED | REJECTED | FAILED | VOIDED | PROCESSING | PENDING
  p_bold_payment_id text    DEFAULT NULL,
  p_amount          numeric DEFAULT NULL,
  p_method          text    DEFAULT NULL,
  p_raw             jsonb   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p             public.booking_payment%ROWTYPE;
  v_b             public.booking%ROWTYPE;
  v_status        text;
  v_outcome       text;
  v_client        text;
  v_client_avatar text;
  v_pawwer        text;
  v_pawwer_avatar text;
BEGIN
  v_status := CASE upper(COALESCE(p_bold_status, ''))
    WHEN 'APPROVED'   THEN 'aprobado'
    WHEN 'REJECTED'   THEN 'rechazado'
    WHEN 'FAILED'     THEN 'fallido'
    WHEN 'VOIDED'     THEN 'anulado'
    WHEN 'PROCESSING' THEN 'procesando'
    WHEN 'PENDING'    THEN 'procesando'   -- solo PSE
    ELSE NULL
  END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Estado de Bold desconocido: %', p_bold_status;
  END IF;

  SELECT * INTO v_p
  FROM   public.booking_payment
  WHERE  order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'orden_desconocida');
  END IF;

  -- Idempotencia. Bold reintenta el webhook hasta cinco veces, y la consulta al
  -- volver del checkout puede llegar antes o después que él: nada de esto puede
  -- confirmar, anotar ni reembolsar dos veces. Un pago aprobado solo puede pasar
  -- a anulado; un anulado ya no cambia.
  IF v_p.status = 'anulado'
     OR (v_p.status = 'aprobado' AND v_status <> 'anulado') THEN
    RETURN jsonb_build_object('result', 'ya_registrado', 'outcome', v_p.outcome,
                              'booking_id', v_p.booking_id);
  END IF;

  -- ── Un pago que no se concretó, o que sigue en proceso ──────
  IF v_status IN ('rechazado', 'fallido', 'procesando') THEN
    UPDATE public.booking_payment
    SET status          = v_status,
        bold_payment_id = COALESCE(p_bold_payment_id, bold_payment_id),
        payment_method  = COALESCE(p_method, payment_method),
        raw             = COALESCE(p_raw, raw),
        updated_at      = now()
    WHERE id = v_p.id;

    RETURN jsonb_build_object('result', v_status, 'booking_id', v_p.booking_id);
  END IF;

  -- ── Una anulación: el reembolso se hizo en el panel de Bold ─
  IF v_status = 'anulado' THEN
    UPDATE public.booking_payment
    SET status        = 'anulado',
        refund_amount = COALESCE(refund_amount, amount),
        refund_reason = COALESCE(refund_reason, 'anulado_en_bold'),
        refunded_at   = now(),
        raw           = COALESCE(p_raw, raw),
        updated_at    = now()
    WHERE id = v_p.id;

    RETURN jsonb_build_object('result', 'anulado', 'booking_id', v_p.booking_id);
  END IF;

  -- ── Un pago aprobado ────────────────────────────────────────
  UPDATE public.booking_payment
  SET status          = 'aprobado',
      bold_payment_id = COALESCE(p_bold_payment_id, bold_payment_id),
      payment_method  = COALESCE(p_method, payment_method),
      raw             = COALESCE(p_raw, raw),
      updated_at      = now()
  WHERE id = v_p.id;

  -- El monto viaja firmado —la firma de integridad lo incluye—, así que esto no
  -- debería pasar nunca. Si pasa, no se confirma nada: se revisa a mano.
  IF p_amount IS NOT NULL AND ROUND(p_amount, 0) <> ROUND(v_p.amount, 0) THEN
    UPDATE public.booking_payment
    SET outcome = 'monto_distinto', refund_amount = p_amount, refund_reason = 'monto_distinto'
    WHERE id = v_p.id;

    RETURN jsonb_build_object('result', 'aprobado', 'outcome', 'monto_distinto',
                              'booking_id', v_p.booking_id);
  END IF;

  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = v_p.booking_id
  FOR UPDATE;

  IF v_b.charged_at IS NOT NULL THEN
    v_outcome := 'duplicado';            -- otra orden de esta reserva ya la había pagado
  ELSIF v_b.status_id = 2 AND v_b.payment_due_at IS NOT NULL THEN
    v_outcome := 'confirmo';
  ELSE
    v_outcome := 'tardio';               -- venció o se canceló antes de que llegara el pago
  END IF;

  IF v_outcome <> 'confirmo' THEN
    UPDATE public.booking_payment
    SET outcome       = v_outcome,
        refund_amount = COALESCE(p_amount, amount),
        refund_reason = CASE v_outcome WHEN 'duplicado' THEN 'pago_duplicado'
                                       ELSE 'pago_tardio' END
    WHERE id = v_p.id;

    RETURN jsonb_build_object('result', 'aprobado', 'outcome', v_outcome,
                              'booking_id', v_b.id, 'client_id', v_b.client_id,
                              'pawwer_id', v_b.pawwer_id);
  END IF;

  -- Confirmada: es el segundo de los dos consentimientos.
  UPDATE public.booking         SET charged_at = now()     WHERE id = v_b.id;
  UPDATE public.booking_payment SET outcome    = 'confirmo' WHERE id = v_p.id;

  -- Ahora sí se abre el chat.
  INSERT INTO public.messages (booking_id, sender_id, content, is_system)
  VALUES (v_b.id, NULL,
          '¡Reserva confirmada! Coordinen aquí los detalles del cuidado. 🐾',
          true);

  SELECT name, avatar_url INTO v_client, v_client_avatar
  FROM   public.profile WHERE id = v_b.client_id;
  SELECT name, avatar_url INTO v_pawwer, v_pawwer_avatar
  FROM   public.profile WHERE id = v_b.pawwer_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
  VALUES
    (v_b.client_id, 'pago', 'Pago recibido',
     'Tu reserva con ' || COALESCE(v_pawwer, 'tu Pawwer') || ' quedó confirmada.',
     v_b.id, v_pawwer, v_pawwer_avatar, '/booking/confirmada/' || v_b.id),
    (v_b.pawwer_id, 'pago', 'Cuidado confirmado',
     COALESCE(v_client, 'El cliente') || ' pagó. El cuidado es firme.',
     v_b.id, v_client, v_client_avatar, '/pawwer/cuidados/' || v_b.id);

  RETURN jsonb_build_object('result', 'aprobado', 'outcome', 'confirmo',
                            'booking_id', v_b.id, 'client_id', v_b.client_id,
                            'pawwer_id', v_b.pawwer_id);
END;
$$;

REVOKE ALL    ON FUNCTION public.record_booking_payment(text, text, text, numeric, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_booking_payment(text, text, text, numeric, text, jsonb)
  TO service_role;

-- ── 7. run_booking_cron: vence lo aceptado y no pagado ────────
CREATE OR REPLACE FUNCTION public.run_booking_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id             uuid;
  v_b              public.booking%ROWTYPE;
  v_escalated      int := 0;
  v_expired        int := 0;
  v_stage2_expired int := 0;
  v_unpaid         int := 0;
  v_n_dogs         int;
  v_pawwer_name    text;
BEGIN
  -- ── 1. Etapa 1 vencida ─────────────────────────────────────
  -- Con consentimiento del cliente pasa a la bolsa general; sin él muere como
  -- sin_cuidador. El cliente eligió ESA casa: no se le sustituye sin permiso.
  FOR v_id IN
    SELECT id FROM public.booking
    WHERE status_id = 1 AND search_phase = 1
      AND phase_expires_at IS NOT NULL AND phase_expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    IF NOT (SELECT allow_pool FROM public.booking WHERE id = v_id) THEN
      UPDATE public.booking
      SET    status_id = 6, phase_expires_at = NULL
      WHERE  id = v_id;
      v_expired := v_expired + 1;
      CONTINUE;
    END IF;

    UPDATE public.booking
    SET search_phase = 2, phase_expires_at = now() + INTERVAL '6 hours'
    WHERE id = v_id;

    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT v_id, cand.pawwer_id, 2
    FROM   public.find_escalation_candidates(v_id, 2) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;

    -- soltar al pawwer original (deja de aparecerle / no puede aceptar vencida)
    UPDATE public.booking SET pawwer_id = NULL WHERE id = v_id;
    v_escalated := v_escalated + 1;
  END LOOP;

  -- ── 2. Etapa 2 vencida → sin_cuidador (6) ──────────────────
  UPDATE public.booking
  SET    status_id = 6, phase_expires_at = NULL
  WHERE  status_id = 1 AND search_phase = 2
    AND  phase_expires_at IS NOT NULL AND phase_expires_at <= now();
  GET DIAGNOSTICS v_stage2_expired = ROW_COUNT;
  v_expired := v_expired + v_stage2_expired;

  -- ── 3. Aceptada y sin pagar → vence ────────────────────────
  -- El checkout de Bold se cierra en payment_due_at. Los 20 minutos de gracia
  -- son para un PSE que el cliente empezó a tiempo y el banco confirma tarde.
  -- Si aun así llega un pago después, record_booking_payment lo marca como
  -- tardío y queda anotado para reembolso.
  FOR v_b IN
    SELECT * FROM public.booking
    WHERE status_id = 2 AND charged_at IS NULL
      AND payment_due_at IS NOT NULL
      AND payment_due_at + INTERVAL '20 minutes' <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT COUNT(*) INTO v_n_dogs
    FROM   public.dog_booking WHERE booking_id = v_b.id;

    UPDATE public.availability
    SET   slots_remaining = slots_remaining + GREATEST(v_n_dogs, 1)
    WHERE pawwer_id = v_b.pawwer_id
      AND date BETWEEN v_b.start_date AND v_b.end_date;

    -- 'system': no cuenta contra el nivel del Pawwer, que sí aceptó.
    UPDATE public.booking
    SET status_id = 5, cancelled_by = 'system'
    WHERE id = v_b.id;

    SELECT name INTO v_pawwer_name FROM public.profile WHERE id = v_b.pawwer_id;

    INSERT INTO public.notifications (user_id, type, title, body, booking_id, link)
    VALUES
      (v_b.client_id, 'pago', 'Se venció el plazo para pagar',
       'Tu reserva con ' || COALESCE(v_pawwer_name, 'el Pawwer')
         || ' se liberó porque el pago no se registró a tiempo.',
       v_b.id, '/booking/confirmada/' || v_b.id),
      (v_b.pawwer_id, 'cuidado', 'La reserva no se pagó',
       'El cliente no pagó a tiempo. Tu cupo de esas fechas quedó libre otra vez.',
       v_b.id, '/pawwer/cuidados/' || v_b.id);

    v_unpaid := v_unpaid + 1;
  END LOOP;

  -- ── 4. Avance de estados por tiempo (global) ───────────────
  PERFORM public.advance_all_booking_statuses();

  RETURN jsonb_build_object('escalated', v_escalated, 'expired', v_expired,
                            'unpaid_expired', v_unpaid, 'ran_at', now());
END;
$$;

-- ── 8. Avance por tiempo: sin pago no empieza ─────────────────
-- confirmada (2) → en curso (3) solo si está PAGADA, o si es anterior a S2
-- (payment_due_at NULL: se aceptó antes de que existiera la pasarela).
CREATE OR REPLACE FUNCTION public.advance_all_booking_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.booking
  SET    status_id = 3
  WHERE  status_id = 2
    AND  (charged_at IS NOT NULL OR payment_due_at IS NULL)
    AND  ((start_date + COALESCE(start_time, TIME '00:00')) AT TIME ZONE 'America/Bogota') <= now();

  UPDATE public.booking
  SET    status_id = 4
  WHERE  status_id = 3
    AND  (((end_date + COALESCE(end_time, TIME '23:59'))
           + CASE WHEN start_date = end_date
                    AND COALESCE(end_time, TIME '23:59') <= COALESCE(start_time, TIME '00:00')
                  THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
          ) AT TIME ZONE 'America/Bogota') <= now();
END;
$$;

-- La copia que corre cuando el Pawwer abre Inicio o Cuidados.
--
-- 🐛 Ya NO escala a la bolsa. Seguía con la lógica de la mig 40 —anterior a
-- allow_pool— y mandaba a la bolsa reservas cuyo cliente había dicho que no,
-- justo en el minuto en que el Pawwer tiene la app abierta mirando cómo se le
-- vence la hora. La escalación la hace solo run_booking_cron, cada minuto.
CREATE OR REPLACE FUNCTION public.advance_booking_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  UPDATE public.booking
  SET    status_id = 3
  WHERE  pawwer_id = v_uid AND status_id = 2
    AND  (charged_at IS NOT NULL OR payment_due_at IS NULL)
    AND  ((start_date + COALESCE(start_time, TIME '00:00')) AT TIME ZONE 'America/Bogota') <= now();

  UPDATE public.booking
  SET    status_id = 4
  WHERE  pawwer_id = v_uid AND status_id = 3
    AND  (((end_date + COALESCE(end_time, TIME '23:59'))
           + CASE WHEN start_date = end_date
                    AND COALESCE(end_time, TIME '23:59') <= COALESCE(start_time, TIME '00:00')
                  THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
          ) AT TIME ZONE 'America/Bogota') <= now();
END;
$$;

-- ── 9. cancel_booking (Pawwer): si ya se cobró, se devuelve todo ─
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b      public.booking%ROWTYPE;
  v_name   text;
  v_avatar text;
  v_n_dogs int;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND pawwer_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuidado no encontrado';
  END IF;
  IF v_b.status_id NOT IN (2, 3) THEN
    RAISE EXCEPTION 'Solo puedes cancelar un cuidado confirmado o en curso';
  END IF;

  -- Devolver tantos lugares como perros consumió la reserva.
  SELECT COUNT(*) INTO v_n_dogs
  FROM   public.dog_booking WHERE booking_id = p_booking_id;

  UPDATE public.availability
  SET   slots_remaining = slots_remaining + GREATEST(v_n_dogs, 1)
  WHERE pawwer_id = auth.uid()
    AND date BETWEEN v_b.start_date AND v_b.end_date;

  UPDATE public.booking SET status_id = 5, cancelled_by = 'pawwer' WHERE id = p_booking_id;

  -- Si el cliente ya pagó, se le devuelve el 100%. Queda anotado para el admin:
  -- Bold solo anula tarjetas de crédito el mismo día, así que casi siempre es
  -- una transferencia manual.
  IF v_b.charged_at IS NOT NULL THEN
    UPDATE public.booking_payment
    SET refund_amount = amount, refund_reason = 'cancelo_pawwer', updated_at = now()
    WHERE booking_id = p_booking_id AND outcome = 'confirmo' AND refunded_at IS NULL;
  END IF;

  SELECT name, avatar_url INTO v_name, v_avatar
  FROM   public.profile WHERE id = auth.uid();

  -- Antes decía «Te ayudaremos a encontrar otro»: Pawwi no hace eso, y el
  -- producto no promete lo que el sistema no cumple.
  INSERT INTO public.notifications
    (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
  VALUES
    (v_b.client_id, 'cuidado',
     'Cuidado cancelado',
     COALESCE(v_name, 'El Pawwer') || ' canceló tu cuidado.'
       || CASE WHEN v_b.charged_at IS NOT NULL
               THEN ' Te devolvemos el 100% de lo que pagaste.'
               ELSE ' No se te cobró nada.' END,
     p_booking_id, v_name, v_avatar, '/booking/confirmada/' || p_booking_id);

  -- El mensaje de sistema solo si el chat existía: pagada, o anterior a S2.
  IF v_b.charged_at IS NOT NULL OR v_b.payment_due_at IS NULL THEN
    INSERT INTO public.messages (booking_id, sender_id, content, is_system)
    VALUES (p_booking_id, NULL,
            'El Pawwer canceló este cuidado. Lamentamos el inconveniente. 😔',
            true);
  END IF;

  -- La cancelación cuenta contra el Pawwer → recalcular su nivel.
  PERFORM public.recompute_pawwer_level(auth.uid());
END;
$$;

-- ── 10. cancel_booking_client: la política de las 48 horas ────
-- Cambia el tipo de retorno (void → jsonb): DROP y CREATE, misma firma.
DROP FUNCTION IF EXISTS public.cancel_booking_client(uuid);

CREATE FUNCTION public.cancel_booking_client(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b      public.booking%ROWTYPE;
  v_name   text;
  v_avatar text;
  v_n_dogs int;
  v_start  timestamptz;
  v_refund numeric := 0;
  v_late   boolean := false;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND client_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;
  IF v_b.status_id NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Solo puedes cancelar antes de que inicie el cuidado';
  END IF;

  -- La política (decidida el 2026-09-11) solo toca lo PAGADO:
  --   • faltan 48 h o más → se devuelve el 100%
  --   • faltan menos      → no hay reembolso, y el Pawwer cobra su parte: bloqueó
  --                         el día y ya no le da tiempo de llenarlo
  -- La misma regla la calcula get_cancellation_terms para mostrarla ANTES de
  -- confirmar. Si cambia aquí, cambia allá.
  IF v_b.status_id = 2 AND v_b.charged_at IS NOT NULL THEN
    v_start := (v_b.start_date + COALESCE(v_b.start_time, TIME '00:00')) AT TIME ZONE 'America/Bogota';
    IF v_start - now() >= INTERVAL '48 hours' THEN
      v_refund := v_b.total;
      UPDATE public.booking_payment
      SET refund_amount = amount, refund_reason = 'cancelo_cliente', updated_at = now()
      WHERE booking_id = p_booking_id AND outcome = 'confirmo' AND refunded_at IS NULL;
    ELSE
      v_late := true;
    END IF;
  END IF;

  IF v_b.status_id = 2 AND v_b.pawwer_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_n_dogs
    FROM   public.dog_booking WHERE booking_id = p_booking_id;

    UPDATE public.availability
    SET   slots_remaining = slots_remaining + GREATEST(v_n_dogs, 1)
    WHERE pawwer_id = v_b.pawwer_id
      AND date BETWEEN v_b.start_date AND v_b.end_date;
  END IF;

  -- La cancela el cliente → no penaliza el cancel_rate del Pawwer.
  UPDATE public.booking
  SET status_id = 5, cancelled_by = 'client', late_cancel = v_late
  WHERE id = p_booking_id;
  DELETE FROM public.booking_candidates WHERE booking_id = p_booking_id;

  IF v_b.pawwer_id IS NOT NULL THEN
    SELECT name, avatar_url INTO v_name, v_avatar FROM public.profile WHERE id = auth.uid();

    INSERT INTO public.notifications
      (user_id, type, title, body, booking_id, actor_name, actor_avatar, link)
    VALUES
      (v_b.pawwer_id, 'cuidado', 'Cuidado cancelado por el cliente',
       COALESCE(v_name, 'El cliente') || ' canceló su reserva.'
         || CASE WHEN v_late
                 THEN ' Faltaban menos de 48 horas: se te paga tu parte igual, el viernes.'
                 ELSE '' END,
       p_booking_id, v_name, v_avatar, '/pawwer/cuidados/' || p_booking_id);

    IF v_b.status_id = 2 AND (v_b.charged_at IS NOT NULL OR v_b.payment_due_at IS NULL) THEN
      INSERT INTO public.messages (booking_id, sender_id, content, is_system)
      VALUES (p_booking_id, NULL, 'El cliente canceló este cuidado. 😔', true);
    END IF;
  END IF;

  RETURN jsonb_build_object('refund', v_refund, 'late', v_late);
END;
$$;

REVOKE ALL    ON FUNCTION public.cancel_booking_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking_client(uuid) TO authenticated;

-- ── 11. get_cancellation_terms: lo que el cliente ve ANTES de cancelar ─
CREATE OR REPLACE FUNCTION public.get_cancellation_terms(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_b     public.booking%ROWTYPE;
  v_start timestamptz;
  v_hours numeric;
BEGIN
  SELECT * INTO v_b
  FROM   public.booking
  WHERE  id = p_booking_id AND client_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  v_start := (v_b.start_date + COALESCE(v_b.start_time, TIME '00:00')) AT TIME ZONE 'America/Bogota';
  v_hours := EXTRACT(EPOCH FROM (v_start - now())) / 3600;

  RETURN jsonb_build_object(
    'can_cancel', v_b.status_id IN (1, 2),
    'charged',    v_b.charged_at IS NOT NULL,
    'hours_left', floor(v_hours),
    'refund',     CASE WHEN v_b.charged_at IS NOT NULL AND v_hours >= 48
                       THEN v_b.total ELSE 0 END,
    'late',       v_b.charged_at IS NOT NULL AND v_hours < 48
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.get_cancellation_terms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cancellation_terms(uuid) TO authenticated;

-- ── 12. send_message: el chat se abre al pagar ────────────────
CREATE OR REPLACE FUNCTION public.send_message(
  p_booking_id uuid,
  p_content    text,
  p_photo_url  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Acceso: debe ser parte de la reserva
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id = p_booking_id AND (client_id = auth.uid() OR pawwer_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este chat';
  END IF;

  -- Estado: confirmada —y PAGADA— o en curso. Aceptada sin pagar todavía no es
  -- una reserva firme, y abrir el chat ahí es invitar a cerrar el trato por fuera.
  IF NOT EXISTS (
    SELECT 1 FROM public.booking
    WHERE id = p_booking_id AND status_id IN (2, 3)
      AND (charged_at IS NOT NULL OR payment_due_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'El chat se abre cuando la reserva está pagada y se cierra cuando el cuidado termina';
  END IF;

  -- No vacío
  IF (p_content IS NULL OR trim(p_content) = '') AND p_photo_url IS NULL THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío';
  END IF;

  -- Longitud máxima (evita mensajes gigantes que inflan la BD)
  IF p_content IS NOT NULL AND char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'El mensaje es demasiado largo (máx. 2000 caracteres)';
  END IF;

  -- La foto SOLO puede ser una URL de nuestro bucket público chat-photos.
  IF p_photo_url IS NOT NULL
     AND p_photo_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/chat-photos/' THEN
    RAISE EXCEPTION 'URL de imagen inválida';
  END IF;

  -- Moderación: no compartir contacto (mantener la transacción en Pawwi).
  IF p_content IS NOT NULL AND (
       p_content ~  '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
    OR p_content ~  '(\d[ .\-]?){7,}'
  ) THEN
    RAISE EXCEPTION 'Por seguridad, no compartas correos ni números de teléfono en el chat';
  END IF;

  INSERT INTO public.messages (booking_id, sender_id, content, photo_url)
  VALUES (p_booking_id, auth.uid(), p_content, p_photo_url)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 13. Lo que ve el Pawwer: el pago, su ganancia y la dirección ─
-- La dirección exacta del cliente aparece cuando la reserva está PAGADA
-- (decisión del 2026-09-11), simétrica con el cliente, que ve la del Pawwer al
-- pagar. Antes bastaba con que b.pawwer_id fuera él — y en la etapa 1 lo es
-- desde que se crea la solicitud: el Pawwer elegido veía la casa del cliente
-- sin haber aceptado nada. Después del cuidado tampoco la necesita.
--
-- Y una solicitud abierta (status 1) se le muestra con SU comisión: desde esta
-- migración la tasa es la del Pawwer que acepta, así que un candidato de la
-- bolsa tiene que ver lo que ganaría ÉL, no lo que ganaría el Pawwer que el
-- cliente eligió. Si no, un Nuevo podía leer «80%» y cobrar 75% — el mismo
-- defecto del «Élite» de Ganancias.
CREATE OR REPLACE FUNCTION public.get_pawwer_bookings(p_status_ids int[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result  jsonb;
  v_my_rate numeric := CASE WHEN public.compute_pawwer_level(auth.uid()) = 'ranger'
                            THEN 0.20 ELSE 0.25 END;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id, 'start_date', b.start_date, 'end_date', b.end_date,
      'start_time', b.start_time, 'end_time', b.end_time,
      'total', b.total,
      'pawwer_payout', CASE WHEN b.status_id = 1
                            THEN b.total - ROUND((b.total - COALESCE(b.transport_fee, 0)) * v_my_rate, 0)
                                         - ROUND(COALESCE(b.transport_fee, 0) * v_my_rate, 0)
                            ELSE b.pawwer_payout END,
      'commission_rate', CASE WHEN b.status_id = 1 THEN v_my_rate ELSE b.commission_rate END,
      'paid_at', b.paid_at, 'accepted_at', b.accepted_at,
      'charged_at', b.charged_at, 'payment_due_at', b.payment_due_at,
      'late_cancel', b.late_cancel, 'pawwer_earns', b.pawwer_earns,
      'status_id', b.status_id, 'search_phase', b.search_phase,
      'phase_expires_at', b.phase_expires_at, 'created_at', b.created_at,
      'client_lat', CASE WHEN b.pawwer_id = auth.uid() AND b.status_id IN (2, 3)
                              AND (b.charged_at IS NOT NULL OR b.payment_due_at IS NULL)
                         THEN b.client_lat
                         ELSE round(b.client_lat::numeric, 2)::double precision END,
      'client_lng', CASE WHEN b.pawwer_id = auth.uid() AND b.status_id IN (2, 3)
                              AND (b.charged_at IS NOT NULL OR b.payment_due_at IS NULL)
                         THEN b.client_lng
                         ELSE round(b.client_lng::numeric, 2)::double precision END,
      'client_neighborhood', b.client_neighborhood,
      'client_address', CASE WHEN b.pawwer_id = auth.uid() AND b.status_id IN (2, 3)
                                  AND (b.charged_at IS NOT NULL OR b.payment_due_at IS NULL)
                             THEN b.client_address ELSE NULL END,
      'transport_legs', b.transport_legs, 'transport_fee', b.transport_fee,
      'service_type', st.name,
      'client', jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url),
      'dogs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', d.name, 'breed', d.breed, 'photo_url', d.photo_url, 'weight_kg', d.weight_kg,
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

CREATE OR REPLACE FUNCTION public.get_pawwer_booking_detail(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result  jsonb;
  v_my_rate numeric := CASE WHEN public.compute_pawwer_level(auth.uid()) = 'ranger'
                            THEN 0.20 ELSE 0.25 END;
BEGIN
  SELECT jsonb_build_object(
    'id', b.id, 'start_date', b.start_date, 'end_date', b.end_date,
    'start_time', b.start_time, 'end_time', b.end_time,
    'total', b.total,
    'pawwer_payout', CASE WHEN b.status_id = 1
                          THEN b.total - ROUND((b.total - COALESCE(b.transport_fee, 0)) * v_my_rate, 0)
                                       - ROUND(COALESCE(b.transport_fee, 0) * v_my_rate, 0)
                          ELSE b.pawwer_payout END,
    'commission_rate', CASE WHEN b.status_id = 1 THEN v_my_rate ELSE b.commission_rate END,
    'paid_at', b.paid_at, 'accepted_at', b.accepted_at,
    'charged_at', b.charged_at, 'payment_due_at', b.payment_due_at,
    'late_cancel', b.late_cancel, 'pawwer_earns', b.pawwer_earns,
    'status_id', b.status_id, 'search_phase', b.search_phase,
    'phase_expires_at', b.phase_expires_at, 'created_at', b.created_at,
    'comments', b.comments,
    'client_lat', CASE WHEN b.pawwer_id = auth.uid() AND b.status_id IN (2, 3)
                            AND (b.charged_at IS NOT NULL OR b.payment_due_at IS NULL)
                       THEN b.client_lat
                       ELSE round(b.client_lat::numeric, 2)::double precision END,
    'client_lng', CASE WHEN b.pawwer_id = auth.uid() AND b.status_id IN (2, 3)
                            AND (b.charged_at IS NOT NULL OR b.payment_due_at IS NULL)
                       THEN b.client_lng
                       ELSE round(b.client_lng::numeric, 2)::double precision END,
    'client_neighborhood', b.client_neighborhood,
    'client_address', CASE WHEN b.pawwer_id = auth.uid() AND b.status_id IN (2, 3)
                                AND (b.charged_at IS NOT NULL OR b.payment_due_at IS NULL)
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

-- ── 14. Lo que se le debe al Pawwer: pawwer_earns, no status 4 ─
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
    'next_payout_amount', COALESCE(SUM(pawwer_payout) FILTER (WHERE pawwer_earns AND paid_at IS NULL), 0),
    'pending_count',      COALESCE(COUNT(*)           FILTER (WHERE pawwer_earns AND paid_at IS NULL), 0),
    'paid_total',         COALESCE(SUM(pawwer_payout) FILTER (WHERE pawwer_earns AND paid_at IS NOT NULL), 0),
    'lifetime_earnings',  COALESCE(SUM(pawwer_payout) FILTER (WHERE pawwer_earns), 0)
  )
  INTO v_result
  FROM public.booking
  WHERE pawwer_id = v_uid;

  RETURN v_result;
END;
$$;

-- Sigue siendo solo de service_role (la mig 48 le revocó a authenticated; CREATE
-- OR REPLACE conserva esos permisos).
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
  WHERE  pawwer_earns
    AND  paid_at IS NULL
    AND  (p_pawwer_id IS NULL OR pawwer_id = p_pawwer_id)
    AND  (p_up_to     IS NULL OR end_date <= p_up_to);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pawwer_stats(p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_uid    uuid := auth.uid();
BEGIN
  SELECT jsonb_build_object(
    'bookings_completed', COUNT(*)    FILTER (WHERE status_id = 4 AND start_date BETWEEN p_start AND p_end),
    'pawwer_earnings',    COALESCE(SUM(pawwer_payout) FILTER (WHERE pawwer_earns AND start_date BETWEEN p_start AND p_end), 0),
    'active_bookings',    COUNT(*)    FILTER (WHERE status_id = 3),
    'pending_bookings', (
      -- Directas (etapa 1) + candidaturas de la bolsa (etapa 2)
      SELECT COUNT(*) FROM public.booking b2
      WHERE b2.status_id = 1
        AND (b2.pawwer_id = v_uid
             OR EXISTS (SELECT 1 FROM public.booking_candidates bc
                        WHERE bc.booking_id = b2.id AND bc.pawwer_id = v_uid))
    )
  )
  INTO v_result
  FROM public.booking
  WHERE pawwer_id = v_uid;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pawwer_earnings_daily(p_start date, p_end date)
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
      'date',     to_char(d.day::date, 'YYYY-MM-DD'),
      'earnings', COALESCE(agg.total_earnings, 0),
      'count',    COALESCE(agg.total_count, 0)
    )
    ORDER BY d.day
  ), '[]'::jsonb)
  INTO v_result
  FROM generate_series(p_start, p_end, '1 day'::interval) AS d(day)
  LEFT JOIN (
    SELECT
      start_date,
      SUM(pawwer_payout)::numeric AS total_earnings,
      COUNT(*)::int               AS total_count
    FROM public.booking
    WHERE pawwer_id = auth.uid()
      AND pawwer_earns
      AND start_date BETWEEN p_start AND p_end
    GROUP BY start_date
  ) agg ON agg.start_date = d.day::date;

  RETURN v_result;
END;
$$;

-- ── 15. La bolsa: techo bien medido, transporte y tope de perros ─
CREATE OR REPLACE FUNCTION public.find_escalation_candidates(
  p_booking_id uuid,
  -- p_phase ya no se usa en el cuerpo: con una sola etapa de bolsa no hay
  -- criterios distintos por fase. Se conserva en la firma para no romper la
  -- llamada del cron ni obligar a un DROP; el valor que se pasa es siempre 2.
  p_phase      int
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
  v_start_date      date;
  v_end_date        date;
  v_units           numeric;
  v_unit_price      numeric;
  v_transport_legs  int;
  v_n_dogs          int;
BEGIN
  SELECT b.service_type_id, b.pawwer_id, b.start_date, b.end_date,
         -- Las unidades que se cobraron: horas en Express (servicio 4), días en
         -- el resto — igual que create_booking. El rango de días es INCLUSIVO.
         CASE WHEN b.service_type_id = 4 THEN GREATEST(COALESCE(b.hours_count, 1), 1)
              ELSE GREATEST(b.end_date - b.start_date + 1, 1) END,
         b.total - COALESCE(b.transport_fee, 0),
         COALESCE(b.transport_legs, 0)
  INTO   v_service_type_id, v_original_pawwer, v_start_date, v_end_date,
         v_units, v_unit_price, v_transport_legs
  FROM   public.booking b
  WHERE  b.id = p_booking_id;

  -- El techo es la TARIFA que el cliente aceptó, por unidad: lo que pagó por el
  -- cuidado —sin transporte— entre los días u horas. Antes era
  -- (pawwer_payout / días) × 1,2: el NETO del Pawwer, con el transporte sumado,
  -- contra la tarifa de LISTA de los candidatos. Con comisión del 25% el techo
  -- real quedaba en el 90% del precio elegido, no en el 100% que dice docs/06; y
  -- en Express comparaba una tarifa por hora contra el total de varias horas.
  v_unit_price := v_unit_price / v_units;

  SELECT COUNT(*) INTO v_n_dogs
  FROM   public.dog_booking WHERE booking_id = p_booking_id;

  RETURN QUERY
  SELECT DISTINCT sxp.id_pawwer
  FROM   public."service_X_Pawwer" sxp
  JOIN   public.pawwer pw ON pw.id = sxp.id_pawwer
  WHERE  sxp.id_service = v_service_type_id
    AND  sxp.is_active  = true
    AND  pw.status      = 'approved'
    AND  pw.accepting_bookings = true          -- ← no pausados
    AND  pw.deactivated_at IS NULL             -- ← no desactivados
    AND  sxp.id_pawwer != COALESCE(v_original_pawwer, '00000000-0000-0000-0000-000000000000'::uuid)
    -- Solo TECHO, sin piso (decisión 07): quien cobre menos puede tomarla y gana
    -- MÁS que su tarifa de lista; nadie cobra más de lo que el cliente aceptó.
    AND  sxp.price <= v_unit_price
    -- El tope de perros que el candidato declaró para ESTE servicio. create_booking
    -- se lo exige al Pawwer elegido; la bolsa no lo miraba.
    AND  COALESCE(sxp.max_animals, 1) >= v_n_dogs
    -- Si el cliente pagó transporte, el candidato tiene que ofrecerlo: si no, el
    -- perro se queda sin quien lo recoja.
    AND  (v_transport_legs = 0 OR COALESCE(pw.transport_price, 0) > 0)
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
               AND  a.slots_remaining >= v_n_dogs      -- cupos en PERROS (mig 61)
           )
         )
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.booking_candidates bc
           WHERE  bc.booking_id = p_booking_id
             AND  bc.pawwer_id  = sxp.id_pawwer
         );
END;
$$;

-- ── 16. delete_availability: la última DEFINER sin search_path ─
-- Desde la mig 06. La auditoría del 2026-09-07 la dio por reemplazada porque su
-- nombre aparecía en la 25, que solo le hizo REVOKE/GRANT. De paso: con
-- «auth.uid() != p_pawwer_id», un auth.uid() NULL no entraba al IF — NULL no es
-- distinto de nada. IS DISTINCT FROM sí lo atrapa.
CREATE OR REPLACE FUNCTION public.delete_availability(
  p_pawwer_id uuid,
  p_date      date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_pawwer_id THEN
    RAISE EXCEPTION 'Solo el Pawwer puede gestionar su disponibilidad';
  END IF;
  DELETE FROM public.availability
  WHERE pawwer_id = p_pawwer_id AND date = p_date;
END;
$$;

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
--   select
--     (select count(*) from information_schema.columns
--       where table_name = 'booking' and column_name in
--         ('charged_at','payment_due_at','late_cancel','pawwer_earns'))               as columnas,
--     (select relrowsecurity from pg_class where relname = 'booking_payment')        as rls_pagos,
--     has_table_privilege('authenticated', 'public.booking_payment', 'SELECT')       as pagos_legibles,
--     has_function_privilege('authenticated',
--       'public.record_booking_payment(text,text,text,numeric,text,jsonb)', 'EXECUTE') as sello_publico,
--     (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in
--       ('accept_booking','cancel_booking_client','start_booking_payment',
--        'record_booking_payment','get_cancellation_terms','get_booking_payment_status')) as firmas,
--     (select count(*) from pg_proc where proname = 'advance_booking_statuses'
--        and pg_get_functiondef(oid) like '%find_escalation_candidates%')           as escala_sin_permiso,
--     (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
--        and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
--                                        where c like 'search_path=%'))              as definer_sin_search_path;
--   -- esperado: 4 · true · false · false · 6 · 0 · 0
