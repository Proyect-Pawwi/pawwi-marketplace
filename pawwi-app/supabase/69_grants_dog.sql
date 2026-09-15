-- ============================================================
-- PAWWI — FIX: no se podía crear NI LISTAR una mascota
-- Correr en Supabase SQL Editor después de 68_cobro_bold.sql
--
-- Síntoma (2026-09-15): «No se pudo guardar la mascota. Intenta de nuevo»,
--   y en el log del servidor:
--     [Pawwi] crearMascota: permission denied for table dog
--   Comprobado también por REST con la sesión real de un cliente:
--     SELECT dog  → 42501 permission denied for table dog
--     INSERT dog  → 42501 permission denied for table dog_booking
--
-- Causa: `authenticated` NUNCA tuvo privilegios sobre public.dog. No se los
--   quitó ninguna migración —no hay un solo GRANT ni REVOKE sobre dog en todo
--   supabase/—: es que nunca se los dio nadie. La 44 lo da por sentado en su
--   comentario final («deberían quedar solo: dog, profile, exam_results»), pero
--   dar por sentado no es conceder.
--
--   El segundo error es el mismo caso que resolvió la migración 43 con booking:
--   la policy `dog_booking_visible` (mig 16) —la que deja al Pawwer ver los
--   perros de SUS reservas— referencia dog_booking en un subquery, y para
--   evaluarla el rol que consulta necesita SELECT sobre esa tabla.
--
-- Por qué no había saltado: es la primera vez que alguien recorre el producto
--   como cliente nuevo. Rompía las cinco lecturas/escrituras directas de dog
--   (`/mis-mascotas`, `/bienvenida`, el selector de perros del paso 3 de la
--   reserva, crear y eliminar) — o sea, RESERVAR ERA IMPOSIBLE.
--
-- Fix: conceder los privilegios que el diseño ya daba por hechos.
-- Es SEGURO: dog tiene RLS y se queda como está —`dog_owner` (el dueño, mig 03)
-- y `dog_booking_visible` (el Pawwer de la reserva, mig 16)—, y dog_booking
-- tiene `dog_booking_parties` (mig 06), que limita a las partes de la reserva.
-- Los privilegios no saltan la RLS: la habilitan.
-- ============================================================

-- ── 1. dog: escritura directa del dueño, como manda el diseño ──
-- (`docs/06` § Patrón de datos: la escritura directa que queda a authenticated
--  es dog, profile, exam_results y capacitacion_results.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog TO authenticated;

-- ── 2. dog_booking: solo LECTURA, y solo para poder evaluar la RLS de dog ──
-- Se escribe únicamente desde create_booking (SECURITY DEFINER); por eso aquí
-- NO se concede INSERT/UPDATE/DELETE.
GRANT SELECT ON public.dog_booking TO authenticated;

-- ── 3. Por si dog.id fuera de secuencia y no uuid ──
-- Inofensivo si es uuid: pg_get_serial_sequence devuelve NULL y no hace nada.
DO $$
DECLARE v_seq text;
BEGIN
  SELECT pg_get_serial_sequence('public.dog', 'id') INTO v_seq;
  IF v_seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', v_seq);
  END IF;
END $$;

-- ── Verificación ──────────────────────────────────────────────
-- Esperado: dog → DELETE, INSERT, SELECT, UPDATE · dog_booking → SELECT
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM   information_schema.role_table_grants
WHERE  grantee = 'authenticated'
  AND  table_schema = 'public'
  AND  table_name IN ('dog', 'dog_booking')
GROUP  BY table_name
ORDER  BY table_name;

-- NOTA — otras tablas sin grants para authenticated, comprobadas el 2026-09-15.
-- No se tocan aquí a propósito:
--   • booking_payment → revocada A PROPÓSITO por la migración 68 (el sello del
--     pago es solo de service_role). Debe seguir así.
--   • client, favourite, dog_size → hoy ningún código las lee directo. `client`
--     y `favourite` las necesitará S4 (KYC y favoritos que persisten); cuando se
--     construyan, van a chocar con esto mismo. Anotado en docs/07 · S4.
