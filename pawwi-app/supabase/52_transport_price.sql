-- ============================================================
-- PAWWI — Editar el precio de transporte desde el perfil (Tarifas)
-- Correr en Supabase SQL Editor después de 51_pause_wiring.sql
--
-- pawwer.transport_price ya existe (se fija en el onboarding). La escritura
-- directa a pawwer está revocada (mig 44), así que agregamos un RPC scopeado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_transport_price(p_price int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_price < 0 OR p_price > 1000000 THEN RAISE EXCEPTION 'Precio de transporte inválido'; END IF;
  UPDATE public.pawwer SET transport_price = p_price WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_transport_price(int) TO authenticated;
