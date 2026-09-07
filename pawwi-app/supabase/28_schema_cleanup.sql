-- ============================================================
-- PAWWI — Limpieza de schema (auditoría)
-- Correr en Supabase SQL Editor después de 27_data_pipeline.sql
-- ============================================================

-- ── M1 — booking.start_date / end_date: timestamptz → date ────
-- El modelo es por fechas (no horas en estas columnas; las horas viven
-- en start_time/end_time). timestamptz arrastraba riesgo de desfase de
-- día por zona horaria y era la causa raíz del bug "NaN".
-- Conversión UTC-safe: los valores se guardaron como medianoche UTC,
-- así que se interpretan en UTC para no correr el día.
ALTER TABLE public.booking
  ALTER COLUMN start_date TYPE date USING (start_date AT TIME ZONE 'UTC')::date,
  ALTER COLUMN end_date   TYPE date USING (end_date   AT TIME ZONE 'UTC')::date;

-- ── Columnas legacy sin uso (verificado: 0 referencias en código y SQL) ──
-- OJO: pawwer.experience (array) NO se elimina — lo usa el perfil público
-- /pawwer/[id]. Aquí solo van las realmente muertas.
ALTER TABLE public.dog     DROP COLUMN IF EXISTS weight;          -- duplicado de weight_kg
ALTER TABLE public.dog     DROP COLUMN IF EXISTS considerations;  -- duplicado de notes
ALTER TABLE public.booking DROP COLUMN IF EXISTS user_rate;       -- sin uso
