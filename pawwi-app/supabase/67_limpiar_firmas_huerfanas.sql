-- ============================================================
-- PAWWI — 🔒 Eliminar las firmas huérfanas de complete_pawwer_onboarding
-- Correr en Supabase SQL Editor después de 66_hotfix_seguridad_embudo.sql
--
-- ── EL PROBLEMA ───────────────────────────────────────────────
-- `CREATE OR REPLACE FUNCTION` solo REEMPLAZA cuando la lista de parámetros
-- coincide. Si cambia, **crea una sobrecarga** y la versión anterior sigue
-- viva y llamable.
--
-- complete_pawwer_onboarding se redefinió tres veces cambiándole la firma:
--   migración 07 →  7 parámetros
--   migración 08 → 13 parámetros
--   migración 09 → 17 parámetros   (la eliminó la mig 66)
--
-- Resultado: desde julio conviven varias funciones con ese nombre, todas
-- SECURITY DEFINER y todas invocables por REST.
--
-- ── POR QUÉ IMPORTA, más allá del desorden ────────────────────
-- Las versiones viejas se quedaron con las validaciones de su época. La de 7
-- parámetros **no tiene el control de mayoría de edad**, que se añadió en la
-- migración 09:
--
--   IF p_fecha_nacimiento > current_date - INTERVAL '18 years' THEN
--     RAISE EXCEPTION 'Debes ser mayor de 18 años para ser Pawwer';
--
-- Hoy se puede llamar esa firma directamente y crear un Pawwer **menor de
-- edad**, sin cédula y sin fecha de nacimiento. PostgREST resuelve por
-- argumentos con nombre, así que la app siempre acierta con la nueva — pero
-- las viejas siguen ahí para quien las llame a propósito.
--
-- ── ALCANCE ───────────────────────────────────────────────────
-- Se auditaron TODAS las funciones de `public` buscando firmas duplicadas.
-- complete_pawwer_onboarding es la única. create_booking estuvo a punto de
-- caer en lo mismo en la mig 64 y allí sí se eliminó la firma vieja.
--
--   select p.proname, count(*),
--          string_agg(pg_get_function_identity_arguments(p.oid), E'\n')
--   from pg_proc p
--   where p.pronamespace = 'public'::regnamespace
--   group by p.proname having count(*) > 1;
--
-- Conviene repetir esa consulta cada vez que se cambie la firma de una RPC.
-- ============================================================

BEGIN;

-- ── La de la migración 07 · 7 parámetros ──────────────────────
-- Es la peligrosa: sin control de edad, sin cédula, sin fecha de nacimiento.
DROP FUNCTION IF EXISTS public.complete_pawwer_onboarding(
  text, text, text, double precision, double precision, jsonb, jsonb);

-- ── La de la migración 08 · 13 parámetros ─────────────────────
-- Tampoco tiene el control de edad, y no escribe mi_espacio ni valores.
DROP FUNCTION IF EXISTS public.complete_pawwer_onboarding(
  text, text, text, double precision, double precision, jsonb, jsonb,
  text, integer, text, text[], text, text[]);

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
--   select count(*) as firmas,
--          pg_get_function_identity_arguments(oid) as argumentos
--   from pg_proc
--   where proname = 'complete_pawwer_onboarding'
--     and pronamespace = 'public'::regnamespace
--   group by oid;
--   -- esperado: UNA fila, la de 19 parámetros que termina en
--   --           p_cedula_front_url text, p_cedula_back_url text
--
-- Y que no quede ninguna otra función con firmas duplicadas:
--
--   select p.proname, count(*)
--   from pg_proc p
--   where p.pronamespace = 'public'::regnamespace
--   group by p.proname having count(*) > 1;
--   -- esperado: cero filas
