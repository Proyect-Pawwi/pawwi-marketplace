-- ============================================================
-- PAWWI — Fix: registro falla por profile.phone = '' vs UNIQUE
-- Correr en Supabase SQL Editor después de 58_client_kyc.sql
--
-- BUG: profile.phone es NOT NULL **y** UNIQUE (constraint profile_phone_key) a la
-- vez, y el trigger handle_new_user insertaba phone = COALESCE(meta->>'phone', '').
-- Combinación venenosa:
--   • NOT NULL → no puede quedar vacío como NULL.
--   • UNIQUE   → solo UN perfil puede tener phone = ''.
-- Resultado: cualquier alta SIN teléfono (Google OAuth, admin API) fallaba con
--   23505 duplicate key ... "profile_phone_key" — Key (phone)=() already exists.
-- (Reproducido con la admin API el 2026-07-17.)
--
-- FIX: hacer phone (y neighborhood) NULLABLES y guardar NULL cuando no hay dato.
-- El UNIQUE trata cada NULL como distinto → varias cuentas sin teléfono conviven,
-- y los teléfonos REALES siguen siendo únicos. neighborhood ya no se pide en el
-- registro del cliente, así que también debe poder ser NULL.
-- Idempotente (DROP NOT NULL + CREATE OR REPLACE + normalización de datos).
-- ============================================================

-- ── 1. phone y neighborhood → NULLABLES ───────────────────────
ALTER TABLE public.profile ALTER COLUMN phone        DROP NOT NULL;
ALTER TABLE public.profile ALTER COLUMN neighborhood DROP NOT NULL;

-- ── 2. Trigger: NULL en vez de '' para phone/neighborhood ─────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile (id, name, phone, role, neighborhood, latitude, longitude)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),          -- '' → NULL (evita choque con el UNIQUE)
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('client', 'pawwer')
        THEN NEW.raw_user_meta_data->>'role'
      ELSE 'client'
    END,
    NULLIF(NEW.raw_user_meta_data->>'neighborhood', ''),
    NULLIF(NEW.raw_user_meta_data->>'lat', '')::double precision,
    NULLIF(NEW.raw_user_meta_data->>'lng', '')::double precision
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 3. Normalizar filas existentes: '' → NULL ────────────────
-- (Libera el "slot" del teléfono vacío para que no vuelva a chocar el UNIQUE.)
UPDATE public.profile SET phone = NULL WHERE phone = '';
UPDATE public.profile SET neighborhood = NULL WHERE neighborhood = '';
