-- ============================================================
-- PAWWI — S1 · Desmontar el transporte prestado por Pawwi
-- Correr en Supabase SQL Editor después de 59_fix_profile_phone_unique.sql
--
-- DECISIÓN 06 del rediseño: «El transporte ocurre entre las partes».
-- Pawwi nunca traslada animales. El traslado lo ofrece el Pawwer como
-- atributo de su perfil (pawwer.transport_price) o lo resuelve el cliente.
--
-- Qué había:
--   Tras aceptar, un popup BLOQUEANTE obligaba al Pawwer a elegir entre
--   'pawwer' y 'pawwi'. Si elegía 'pawwi', la comisión se recalculaba de
--   modo que Pawwi se quedaba con el 100% del transporte.
--
-- Qué queda:
--   create_booking ya fija transport_provider = 'pawwer' cuando hay
--   transporte, y cobra la misma comisión sobre el traslado que sobre el
--   cuidado (75% Pawwer / 25% Pawwi). Esa ruta YA es la correcta: esta
--   migración solo retira la que permitía desviarse de ella.
--
-- Las columnas transport_provider y transport_decided NO se eliminan:
-- quedan congeladas para no perder el histórico. Se borrarán después del
-- lanzamiento, cuando no haya prisa que convierta un DROP en un susto.
-- ============================================================

BEGIN;

-- ── 1. Retirar el RPC que permitía ceder el transporte a Pawwi ─
-- Definido en 29, redefinido en 31 y 36. Ninguna ruta del producto
-- debe poder volver a poner transport_provider = 'pawwi'.
DROP FUNCTION IF EXISTS public.set_transport_provider(uuid, text);

-- ── 2. Normalizar las reservas que siguen vivas ────────────────
-- Una reserva en vuelo (pendiente/confirmada/en curso) con
-- transport_provider = 'pawwi' tiene la comisión calculada con Pawwi
-- quedándose el 100% del traslado. Bajo el modelo nuevo el Pawwer hace
-- el transporte, así que hay que recomputar su pago — respetando la
-- tasa CONGELADA en la reserva (commission_rate), nunca una tasa nueva.
--
-- El histórico (completadas 4, canceladas 5, sin_cuidador 6) NO se toca:
-- es un registro de lo que de verdad ocurrió y ya está liquidado.
UPDATE public.booking b
SET transport_provider = 'pawwer',
    commission    = ROUND((b.total - b.transport_fee) * b.commission_rate, 0)
                  + ROUND(b.transport_fee * b.commission_rate, 0),
    pawwer_payout = b.total
                  - ( ROUND((b.total - b.transport_fee) * b.commission_rate, 0)
                    + ROUND(b.transport_fee * b.commission_rate, 0) )
WHERE b.status_id IN (1, 2, 3)
  AND b.transport_fee > 0
  AND b.transport_provider IS DISTINCT FROM 'pawwer';

-- ── 3. Dejar dicho en el esquema que son columnas muertas ──────
COMMENT ON COLUMN public.booking.transport_provider IS
  'CONGELADA (S1, decisión 06). Siempre ''pawwer'' en reservas nuevas: Pawwi no '
  'transporta. Se conserva por el histórico previo al rediseño. No leer en código.';

COMMENT ON COLUMN public.booking.transport_decided IS
  'CONGELADA (S1, decisión 06). Era el flag del popup bloqueante que elegía quién '
  'hacía el traslado. Ya no existe esa decisión. No leer en código.';

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
-- Esperado: el RPC ya no existe, y ninguna reserva viva cede el
-- transporte a Pawwi.
--
--   select count(*) as rpc_vivo
--   from pg_proc where proname = 'set_transport_provider';
--   -- esperado: 0
--
--   select count(*) as vivas_con_pawwi
--   from public.booking
--   where status_id in (1,2,3) and transport_fee > 0
--     and transport_provider is distinct from 'pawwer';
--   -- esperado: 0
