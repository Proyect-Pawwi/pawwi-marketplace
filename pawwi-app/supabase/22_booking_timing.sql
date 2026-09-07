-- ============================================================
-- PAWWI — Timer de fase 1 al crear booking
-- La escalación fase 1→2→3→sin_cuidador la maneja la Edge Function
-- Fase 1: 1 hora al crear  |  Fase 2: 6h  |  Fase 3: 6h (edge fn)
-- ============================================================

-- ── 1. Trigger: al crear un booking fase 1, pone 1h de expiry ─
CREATE OR REPLACE FUNCTION public.set_booking_phase_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.search_phase = 1 AND NEW.phase_expires_at IS NULL THEN
    NEW.phase_expires_at := now() + INTERVAL '1 hour';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_phase_expiry ON public.booking;
CREATE TRIGGER trg_booking_phase_expiry
  BEFORE INSERT ON public.booking
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_phase_expiry();

-- ── 2. Ajustar bookings de prueba existentes ──────────────────
-- Mueve phase_expires_at a 1h desde ahora para probar el timer
UPDATE public.booking
SET phase_expires_at = now() + INTERVAL '1 hour'
WHERE status_id = 1 AND search_phase = 1;
