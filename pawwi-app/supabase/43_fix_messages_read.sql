-- ============================================================
-- PAWWI — FIX: no se podían LEER los mensajes del chat
-- Correr en Supabase SQL Editor después de 42_chat_moderation.sql
--
-- Síntoma: al leer public.messages, Postgres tiraba
--   "permission denied for table booking" (403).
-- Causa: la policy RLS de messages (messages_select_parties) referencia la
--   tabla booking en un subquery. Para evaluarla, el rol que consulta necesita
--   privilegio SELECT sobre booking — y `authenticated` no lo tenía (booking
--   se leía solo vía RPCs SECURITY DEFINER). Por eso fallaban:
--     • el SELECT directo de mensajes (initialMessages en el server),
--     • el re-fetch del ChatRoom en el cliente,
--     • y la entrega por realtime (que también evalúa la RLS).
--
-- Fix: darle SELECT sobre booking a authenticated. Es SEGURO: booking tiene
-- RLS (booking_client / booking_pawwer) → cada quien solo ve SUS reservas.
-- ============================================================

GRANT SELECT ON public.booking TO authenticated;

-- (Opcional defensivo) los mensajes también los lee authenticated bajo su RLS:
GRANT SELECT ON public.messages TO authenticated;
