-- ============================================================
-- PAWWI — Regenerar la agenda de los Pawwers DE PRUEBA
-- Correr en Supabase SQL Editor después de 61_unificar_capacidad.sql
--
-- ⚠️ ESTO ES DATO DE PRUEBA, NO ESQUEMA. Solo toca los diez Pawwers del
-- seed (05_seed_pawwers.sql), cuyos ids empiezan por
-- 'a1000000-0000-0000-0000-'. Los Pawwers REALES quedan intactos: su
-- disponibilidad la carga cada uno, que es lo que dice el protocolo de la
-- visita domiciliaria («configurar disponibilidad ahí mismo, en su celular»).
--
-- POR QUÉ HACE FALTA: el seed de julio generó agenda a 60 días vista y venció
-- el 2026-08-15. Al 2026-09-09 no quedaba UNA sola fecha futura en toda la
-- tabla, con dos consecuencias que no son bugs del código:
--   • el buscador cruza contra availability al elegir fecha → cero resultados
--   • create_booking exige disponibilidad en CADA día → no se puede crear
--     ninguna reserva, ni de prueba
-- Sin esto no se puede verificar el criterio de cierre de S1.
--
-- El cupo se carga con el max_animals que cada Pawwer declaró, para que el
-- dato nazca coherente con la unificación de la migración 61: slots_remaining
-- cuenta PERROS, no reservas.
-- ============================================================

BEGIN;

INSERT INTO public.availability (pawwer_id, date, slots_remaining)
SELECT p.id,
       d::date,
       cap.max_cap
FROM   public.pawwer p
JOIN   LATERAL (
         SELECT COALESCE(MAX(s.max_animals), 1) AS max_cap
         FROM   public."service_X_Pawwer" s
         WHERE  s.id_pawwer = p.id AND s.is_active = true
       ) cap ON true
CROSS  JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 120, '1 day') d
JOIN   LATERAL (
         SELECT (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])
                  [EXTRACT(DOW FROM d)::int + 1] AS key
       ) dow ON true
WHERE  p.id::text LIKE 'a1000000-0000-0000-0000-%'   -- SOLO los del seed
  AND  p.deactivated_at IS NULL
  -- El día de la semana sale del week_pattern del propio Pawwer, no de una
  -- lista codificada aquí. EXTRACT(DOW) da 0=domingo … 6=sábado, y el array
  -- lo traduce a la clave del jsonb. No se usa to_char(d,'Dy') porque depende
  -- del lc_time del servidor y en un Postgres en español devolvería 'Lun'.
  AND  COALESCE((p.week_pattern ->> dow.key)::boolean, false)
ON CONFLICT (pawwer_id, date) DO NOTHING;

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
--   select count(*) as filas_futuras,
--          count(distinct pawwer_id) as pawwers_con_agenda,
--          min(date) as desde, max(date) as hasta,
--          string_agg(distinct slots_remaining::text, ', ') as cupos
--   from public.availability where date >= current_date;
--   -- esperado: ~800 filas · 10 pawwers · desde hoy · cupos '1, 2, 4'
--
--   -- Y que NINGÚN Pawwer real fue tocado:
--   select count(*) as reales_con_agenda_futura
--   from public.availability a join public.pawwer p on p.id = a.pawwer_id
--   where a.date >= current_date and p.id::text not like 'a1000000-0000-0000-0000-%';
--   -- esperado: 0
--
-- ── Para RESETEAR la agenda de prueba ──────────────────────────
-- El INSERT es ON CONFLICT DO NOTHING, así que repetirlo no devuelve cupos ya
-- consumidos por reservas de prueba — a propósito. Para volver a empezar:
--   delete from public.availability
--   where date >= current_date and pawwer_id::text like 'a1000000-0000-0000-0000-%';
-- y correr este archivo de nuevo.
