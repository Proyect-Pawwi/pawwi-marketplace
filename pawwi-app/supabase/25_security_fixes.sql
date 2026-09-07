-- ============================================================
-- PAWWI — Correcciones de seguridad (auditoría 2026-06-25)
-- Correr en Supabase SQL Editor después de 24_cuidados_card_fields.sql
-- ============================================================

-- ── #1 — Eliminar RPCs muertas e inseguras ────────────────────
-- revert_booking: sin check de dueño + ejecutable por PUBLIC (cualquiera
--   podía cancelar reservas ajenas y alterar disponibilidad). Sin uso en la app.
-- decline_booking: reemplazada por decline_solicitud. Sin uso.
DROP FUNCTION IF EXISTS public.revert_booking(uuid);
DROP FUNCTION IF EXISTS public.decline_booking(uuid);

-- ── #3 + #6 + #11 — create_booking endurecido ─────────────────
-- #3: valida que TODOS los perros sean del cliente (evita IDOR/leak).
-- #6: corta el race de overbooking (UPDATE que no decrementa = aborta).
-- #11: REVOKE de PUBLIC, GRANT solo a authenticated.
CREATE OR REPLACE FUNCTION public.create_booking(
  p_pawwer_id      uuid,
  p_start_date     date,
  p_end_date       date,
  p_service_type_id int,
  p_dog_ids        uuid[],
  p_notes          text    DEFAULT NULL,
  p_hours_count    int     DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid := auth.uid();
  v_price       numeric;
  v_days        int;
  v_total       numeric;
  v_commission  numeric;
  v_payout      numeric;
  v_booking_id  uuid;
  v_missing     int;
  v_bad_dogs    int;
  v_updated     int;
  v_dog_id      uuid;
BEGIN
  IF v_client_id IS NULL THEN
    RETURN json_build_object('error', 'Debes iniciar sesión');
  END IF;

  -- Asegurar que existe registro client
  INSERT INTO public.client (id) VALUES (v_client_id) ON CONFLICT DO NOTHING;

  -- #3 — Validar que cada perro pertenece al cliente
  IF p_dog_ids IS NULL OR array_length(p_dog_ids, 1) IS NULL THEN
    RETURN json_build_object('error', 'Selecciona al menos una mascota');
  END IF;

  SELECT COUNT(*) INTO v_bad_dogs
  FROM   unnest(p_dog_ids) did
  WHERE  NOT EXISTS (
    SELECT 1 FROM public.dog d WHERE d.id = did AND d.owner_id = v_client_id
  );
  IF v_bad_dogs > 0 THEN
    RETURN json_build_object('error', 'Una o más mascotas no te pertenecen');
  END IF;

  -- Precio del servicio
  SELECT price INTO v_price
  FROM public."service_X_Pawwer"
  WHERE id_pawwer = p_pawwer_id
    AND id_service = p_service_type_id
    AND is_active = true;

  IF v_price IS NULL THEN
    RETURN json_build_object('error', 'Servicio no disponible para este Pawwer');
  END IF;

  v_days := (p_end_date - p_start_date) + 1;

  -- Disponibilidad para cada fecha del rango (con lock para concurrencia)
  SELECT COUNT(*) INTO v_missing
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(dt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.pawwer_id = p_pawwer_id
      AND a.date = d.dt::date
      AND a.slots_remaining > 0
  );

  IF v_missing > 0 THEN
    RETURN json_build_object('error', 'No hay disponibilidad para las fechas seleccionadas');
  END IF;

  -- Lock de las filas de disponibilidad del rango
  PERFORM 1 FROM public.availability
  WHERE pawwer_id = p_pawwer_id
    AND date BETWEEN p_start_date AND p_end_date
  FOR UPDATE;

  -- Decrementar slots
  UPDATE public.availability
  SET slots_remaining = slots_remaining - 1
  WHERE pawwer_id = p_pawwer_id
    AND date BETWEEN p_start_date AND p_end_date
    AND slots_remaining > 0;

  -- #6 — Si no se decrementó una fila por cada día, otra reserva ganó el slot.
  -- RAISE revierte toda la transacción (incluyendo los decrementos parciales).
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated < v_days THEN
    RAISE EXCEPTION 'No hay disponibilidad para las fechas seleccionadas';
  END IF;

  -- Total y comisión (siempre en backend)
  IF p_service_type_id = 4 THEN
    v_total := v_price * COALESCE(p_hours_count, 1);   -- Express: por hora
  ELSE
    v_total := v_price * v_days;
  END IF;
  v_commission := ROUND(v_total * 0.25, 0);
  v_payout     := v_total - v_commission;

  INSERT INTO public.booking (
    client_id, pawwer_id, start_date, end_date,
    service_type_id, status_id,
    total, commission, pawwer_payout, hours_count, comments
  ) VALUES (
    v_client_id, p_pawwer_id, p_start_date, p_end_date,
    p_service_type_id, 1,
    v_total, v_commission, v_payout, p_hours_count, p_notes
  )
  RETURNING id INTO v_booking_id;

  FOREACH v_dog_id IN ARRAY p_dog_ids LOOP
    INSERT INTO public.dog_booking (booking_id, dog_id)
    VALUES (v_booking_id, v_dog_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN json_build_object(
    'booking_id',    v_booking_id,
    'total',         v_total,
    'commission',    v_commission,
    'pawwer_payout', v_payout
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, int, uuid[], text, int) TO authenticated;

-- ── #11 — Grants de disponibilidad (ya validan auth.uid internamente) ──
REVOKE ALL ON FUNCTION public.upsert_availability(uuid, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_availability(uuid, date, int) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_availability(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_availability(uuid, date) TO authenticated;

-- ── #5 — RLS de messages: leer ambas partes, escribir/editar solo lo propio ──
DROP POLICY IF EXISTS "messages_parties"      ON public.messages;
DROP POLICY IF EXISTS "messages_select_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_update_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own"   ON public.messages;

CREATE POLICY "messages_select_parties" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.booking b
      WHERE b.id = messages.booking_id
        AND (b.client_id = auth.uid() OR b.pawwer_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.booking b
      WHERE b.id = messages.booking_id
        AND (b.client_id = auth.uid() OR b.pawwer_id = auth.uid())
    )
  );

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (sender_id = auth.uid());
-- Nota: mark_messages_seen es SECURITY DEFINER → puede marcar seen_at de la
-- contraparte sin violar estas políticas (corre como owner).

-- ── #9 — handle_new_user: el rol no debe ser auto-aseverable a valores raros ──
-- Solo se acepta 'client' o 'pawwer' desde metadata; cualquier otra cosa → client.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile (id, name, phone, role, neighborhood)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('client', 'pawwer')
        THEN NEW.raw_user_meta_data->>'role'
      ELSE 'client'
    END,
    COALESCE(NEW.raw_user_meta_data->>'neighborhood', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── #8 — decline_solicitud: en fase 1, soltar pawwer_id al escalar ──
-- Así la solicitud declinada deja de aparecerle al pawwer (get_pawwer_bookings
-- filtra por pawwer_id = auth.uid()). Se nulea DESPUÉS de calcular candidatos,
-- para que find_escalation_candidates siga excluyendo al pawwer original.
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

  -- Fase 1: el pawwer elegido directamente declina
  IF v_b.search_phase = 1 AND v_b.pawwer_id = auth.uid() THEN
    UPDATE public.availability
    SET   slots_remaining = slots_remaining + 1
    WHERE pawwer_id = auth.uid()
      AND date BETWEEN v_b.start_date AND v_b.end_date;

    UPDATE public.booking
    SET search_phase     = 2,
        phase_expires_at = now() + INTERVAL '6 hours'
    WHERE id = p_booking_id;

    -- Candidatos fase 2 (find_escalation_candidates aún ve el pawwer_id original)
    INSERT INTO public.booking_candidates (booking_id, pawwer_id, phase)
    SELECT p_booking_id, cand.pawwer_id, 2
    FROM   public.find_escalation_candidates(p_booking_id, 2) AS cand
    ON CONFLICT (booking_id, pawwer_id) DO NOTHING;

    -- Soltar al pawwer original para que ya no le aparezca
    UPDATE public.booking SET pawwer_id = NULL WHERE id = p_booking_id;

    RETURN;
  END IF;

  -- Fases 2/3: eliminar solo esta candidatura
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
