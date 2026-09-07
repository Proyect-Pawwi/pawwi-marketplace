-- ============================================================
-- PAWWI — PARTE 1: Corregir tablas existentes
-- Correr en Supabase SQL Editor
-- ============================================================

-- ── profile ──────────────────────────────────────────────────
ALTER TABLE public.profile
  RENAME COLUMN adress TO address;

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS neighborhood text;

-- ── pawwer ───────────────────────────────────────────────────
-- Columnas críticas que faltan para búsqueda y perfil
ALTER TABLE public.pawwer
  ADD COLUMN IF NOT EXISTS bio             text,
  ADD COLUMN IF NOT EXISTS lat             double precision,
  ADD COLUMN IF NOT EXISTS lng             double precision,
  ADD COLUMN IF NOT EXISTS verified        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating          numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS experience      text[],
  ADD COLUMN IF NOT EXISTS week_pattern    jsonb,
  ADD COLUMN IF NOT EXISTS neighborhood    text,
  ADD COLUMN IF NOT EXISTS badge           text NOT NULL DEFAULT 'Nuevo';

-- Eliminar home_image_url si existe (reemplazada por Pawwer_images)
ALTER TABLE public.pawwer
  DROP COLUMN IF EXISTS home_image_url;

-- ── booking ──────────────────────────────────────────────────
-- Corregir modelo de comisión según spec:
-- total = lo que paga el cliente
-- commission = total * 0.25
-- pawwer_payout = total * 0.75
-- ELIMINAR base_price y base_p

ALTER TABLE public.booking
  DROP COLUMN IF EXISTS base_price,
  DROP COLUMN IF EXISTS base_p;

ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS pawwer_payout numeric;

-- Asegurar que hours_count es integer (el spec dice int)
-- (ya existe como numeric, lo dejamos así para compatibilidad)

-- ── service_X_Pawwer ─────────────────────────────────────────
-- Falta price y is_active — sin esto no se pueden mostrar precios
ALTER TABLE public."service_X_Pawwer"
  ADD COLUMN IF NOT EXISTS price       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_animals integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active   boolean NOT NULL DEFAULT true;

-- Verificar que service_type tiene el check de Express
-- (Diego usó lookup table en vez de CHECK, pero Express debe estar en los datos)
