-- ============================================================
-- PAWWI — booking.pawwer_id nullable
-- Correr en Supabase SQL Editor después de 25_security_fixes.sql
--
-- MOTIVO: el fix de declive en fase 1 (migración 25, decline_solicitud)
-- hace `UPDATE booking SET pawwer_id = NULL` para que la solicitud
-- declinada deje de aparecerle al pawwer. Pero pawwer_id era NOT NULL,
-- así que ese UPDATE fallaba en runtime. Semánticamente, un booking en
-- búsqueda (fase 2/3 sin aceptante) no tiene pawwer asignado → nullable
-- es lo correcto. accept_booking vuelve a setearlo al aceptar.
-- ============================================================

ALTER TABLE public.booking ALTER COLUMN pawwer_id DROP NOT NULL;
