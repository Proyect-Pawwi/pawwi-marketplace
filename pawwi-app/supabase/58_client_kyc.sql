-- ============================================================
-- PAWWI — KYC del cliente: cédula + celular (Trust & Safety) en `client`
-- Correr en Supabase SQL Editor después de 57_dog_pasaporte.sql
--
-- Portal del Cliente · Bloque 0 (estructura). SOLO agrega columnas (idempotente,
-- aditivo). El filtro real —OTP SMS del celular, validación de cédula, tarjeta
-- Wompi— y el gate en create_booking ("no reservar sin identidad verificada")
-- llegan en la Fase F. El enmascarado PII de la cédula (••••1234 al leer) y su
-- escritura vía RPC se harán junto con ese flujo, siguiendo el patrón de la
-- cuenta de pago del pawwer (write-only + masked).
-- ============================================================

ALTER TABLE public.client
  ADD COLUMN IF NOT EXISTS cedula          text,
  ADD COLUMN IF NOT EXISTS cedula_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS phone_verified  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client.cedula          IS 'KYC: cédula de ciudadanía (PII — enmascarar al leer en Fase F)';
COMMENT ON COLUMN public.client.cedula_verified IS 'KYC: identidad verificada (gate de reserva)';
COMMENT ON COLUMN public.client.phone           IS 'KYC: celular del cliente';
COMMENT ON COLUMN public.client.phone_verified  IS 'KYC: celular validado por OTP SMS';

-- RLS: `client` ya tiene política de dueño (client_own FOR ALL USING
-- auth.uid() = id) desde 06. No se abren grants nuevos aquí: la escritura de
-- estos campos irá por un RPC dedicado en la Fase F, no directa.
