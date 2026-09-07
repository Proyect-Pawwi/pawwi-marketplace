-- ============================================================
-- PAWWI — Blindaje de seguridad (auditoría 2026-07-07)
-- Correr en Supabase SQL Editor después de 43_fix_messages_read.sql
--
-- Hallazgo: varias tablas sensibles tienen policies FOR ALL (incluyen
-- escritura). Si `authenticated` tuviera grants de escritura, un usuario podría
-- por REST modificar SUS filas directamente, saltándose las RPCs validadas:
--   • booking   → cambiar total/comisión/pawwer_payout/status_id (fraude $$).
--   • pawwer    → auto-aprobarse (status='approved') o inflar rating/reviews.
--   • messages  → insertar sin moderación, o editar/borrar el historial.
--   • availability / service_X_Pawwer → saltarse las RPCs de cupos/precios.
--
-- Fix (defensa en profundidad): estas tablas se escriben SOLO por RPCs
-- SECURITY DEFINER, así que REVOCAMOS INSERT/UPDATE/DELETE directos a
-- authenticated/anon. Los SELECT (lecturas) NO se tocan → la app sigue igual.
-- La app solo escribe DIRECTO a dog / profile / exam_results (intactas).
-- ============================================================

-- ── 1. Bloquear escritura directa a tablas sensibles ──────────
REVOKE INSERT, UPDATE, DELETE ON public.booking             FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.pawwer              FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public."service_X_Pawwer"  FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.availability        FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.messages            FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.reviews             FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.notifications       FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.booking_candidates  FROM authenticated, anon;

-- ── 2. Mensajes: inmutables + solo vía send_message (moderación) ──
-- Sin estas policies (y sin grant) no hay forma de insertar/editar/borrar
-- mensajes por REST; el único camino es send_message (que modera correos/
-- teléfonos en el servidor). Se preserva el historial del chat.
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;

-- ── 3. Funciones internas/cron: no ejecutables por usuarios ───
-- Evita que un usuario dispare el cron global o enumere candidatos.
REVOKE EXECUTE ON FUNCTION public.run_booking_cron()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_all_booking_statuses()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_escalation_candidates(uuid, int)  FROM PUBLIC, anon, authenticated;

-- Verificación (opcional): privilegios de escritura que le quedan a authenticated
--   SELECT table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE grantee='authenticated' AND table_schema='public'
--     AND privilege_type IN ('INSERT','UPDATE','DELETE')
--   ORDER BY table_name;
-- Deberían quedar solo: dog, profile, exam_results (y sus derivadas).
