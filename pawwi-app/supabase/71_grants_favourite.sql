-- ============================================================
-- PAWWI — Favoritos que de verdad se guardan
-- Correr en Supabase SQL Editor después de 70_fk_duplicada_service_type.sql
--
-- Síntoma (2026-09-17, Nicolás): «cuando selecciono un perfil en corazón no se
--   guarda en la sección de favoritos».
--
-- Causa, en dos capas:
--   1. `authenticated` NO tiene ningún privilegio sobre public.favourite. Es el
--      mismo caso de `dog` en la migración 69: nadie se los quitó — nadie se los
--      dio. La tabla existe con RLS desde la 03 y lleva huérfana desde entonces.
--   2. Y el código tampoco los guardaba: el corazón de `app/page.tsx` era solo
--      `setFavorites` en memoria, y `/mis-favoritos` no hacía NI UNA consulta.
--      Dos mitades que nunca se tocaron.
--
-- Esta migración resuelve la capa 1. La 2 va en el mismo commit.
--
-- Es SEGURO: `favourite` tiene RLS con la policy `favourite_owner`
-- (`FOR ALL USING (auth.uid() = client_id)`, mig 03), así que cada cliente solo
-- ve y escribe SUS favoritos. Los privilegios no saltan la RLS: la habilitan.
-- ============================================================

GRANT SELECT, INSERT, DELETE ON public.favourite TO authenticated;

-- UPDATE no se concede: un favorito se crea o se borra, no se edita.

-- Por si el id fuera de secuencia y no uuid (inofensivo si es uuid).
DO $$
DECLARE v_seq text;
BEGIN
  SELECT pg_get_serial_sequence('public.favourite', 'id') INTO v_seq;
  IF v_seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', v_seq);
  END IF;
END $$;

-- ── Verificación 1 · privilegios ──────────────────────────────
-- Esperado: favourite → DELETE, INSERT, SELECT
SELECT table_name,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM   information_schema.role_table_grants
WHERE  grantee = 'authenticated' AND table_schema = 'public'
  AND  table_name = 'favourite'
GROUP  BY table_name;

-- ── Verificación 2 · la FORMA de la tabla ─────────────────────
-- La tabla nunca se usó, así que sus columnas no están documentadas en ningún
-- sitio y desde fuera no se pueden leer (PostgREST no publica lo que no tiene
-- grants). Esto dice exactamente qué hay, para cablear el código sin adivinar.
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'favourite'
ORDER  BY ordinal_position;

-- ── Verificación 3 · ¿hay índice único? ───────────────────────
-- Sin un UNIQUE(client_id, pawwer_id), tocar dos veces el corazón crea filas
-- duplicadas. Si sale vacío, hay que añadirlo — se hace en la siguiente.
SELECT i.relname AS indice, pg_get_indexdef(ix.indexrelid) AS definicion
FROM   pg_index ix
JOIN   pg_class i ON i.oid = ix.indexrelid
JOIN   pg_class t ON t.oid = ix.indrelid
WHERE  t.relname = 'favourite' AND ix.indisunique;
