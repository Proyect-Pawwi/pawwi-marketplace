-- ============================================================
-- PAWWI — Pasaporte Pawwi: campos de salud / comportamiento / rutina en `dog`
-- Correr en Supabase SQL Editor después de 56_levels.sql
--
-- Portal del Cliente · Bloque 0 (estructura). SOLO agrega columnas (idempotente,
-- aditivo). El formulario multi-step (PasaporteForm) y el gate en create_booking
-- ("no reservar con pasaporte incompleto") llegan en fases posteriores (C y F).
--
-- NOTA: "vacunas al día" NO se agrega — se reutiliza la columna booleana ya
-- existente `dog.vaccine` (evitamos duplicar y el drift que limpió la mig 28).
-- ============================================================

ALTER TABLE public.dog
  -- Salud
  ADD COLUMN IF NOT EXISTS neutered            boolean,   -- ¿esterilizado?
  ADD COLUMN IF NOT EXISTS medical_notes       text,      -- notas médicas urgentes
  -- Comportamiento (vital para el Pawwer que abre su casa)
  ADD COLUMN IF NOT EXISTS friendly_dogs       boolean,
  ADD COLUMN IF NOT EXISTS friendly_cats       boolean,
  ADD COLUMN IF NOT EXISTS friendly_kids       boolean,
  ADD COLUMN IF NOT EXISTS separation_anxiety  boolean,
  ADD COLUMN IF NOT EXISTS energy_level        text,      -- 'bajo' | 'medio' | 'alto'
  -- Rutina
  ADD COLUMN IF NOT EXISTS feeding_schedule    text,      -- horarios de comida
  ADD COLUMN IF NOT EXISTS house_rules         text;      -- reglas de casa

-- Acotar el nivel de energía (idempotente: se recrea la constraint).
ALTER TABLE public.dog DROP CONSTRAINT IF EXISTS chk_dog_energy;
ALTER TABLE public.dog
  ADD CONSTRAINT chk_dog_energy
  CHECK (energy_level IS NULL OR energy_level IN ('bajo', 'medio', 'alto'));

-- Documentación de columnas.
COMMENT ON COLUMN public.dog.neutered           IS 'Pasaporte: ¿esterilizado?';
COMMENT ON COLUMN public.dog.medical_notes      IS 'Pasaporte: notas médicas urgentes';
COMMENT ON COLUMN public.dog.friendly_dogs      IS 'Pasaporte: amigable con otros perros';
COMMENT ON COLUMN public.dog.friendly_cats      IS 'Pasaporte: amigable con gatos';
COMMENT ON COLUMN public.dog.friendly_kids      IS 'Pasaporte: amigable con niños';
COMMENT ON COLUMN public.dog.separation_anxiety IS 'Pasaporte: sufre ansiedad por separación';
COMMENT ON COLUMN public.dog.energy_level       IS 'Pasaporte: nivel de energía (bajo|medio|alto)';
COMMENT ON COLUMN public.dog.feeding_schedule   IS 'Pasaporte: horarios de comida';
COMMENT ON COLUMN public.dog.house_rules        IS 'Pasaporte: reglas de casa';

-- RLS: `dog` ya tiene política de dueño (owner_id = auth.uid()) desde 03. Estos
-- campos quedan cubiertos sin cambios. Sin nuevos grants ni RPCs en este bloque.
