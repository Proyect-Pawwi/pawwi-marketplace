-- ============================================================
-- PAWWI — Un favorito sin fecha no se puede ordenar
-- Correr en Supabase SQL Editor después de 71_grants_favourite.sql
--
-- La tabla `favourite` resultó tener exactamente TRES columnas —`id`,
-- `client_id`, `pawwer_id`— y ninguna fecha. Se comprobó leyéndola de verdad
-- con un JWT de cliente (`Prefer: return=representation` devuelve la fila
-- entera), no consultando el esquema: la tabla nunca se había usado.
--
-- Sin fecha, una lista de favoritos no tiene por cuál orden mostrarse. El orden
-- que espera cualquiera es «lo último que guardé, primero», y ese dato hoy se
-- pierde en el momento del INSERT.
--
-- Vale además para S3: «qué Pawwers reciben corazones y cuándo» es una métrica
-- del panel, y sin marca de tiempo no se puede contestar ni hacia atrás.
--
-- Es SEGURO y no rompe nada: la columna entra con DEFAULT, así que las filas
-- existentes (si hubiera alguna) la reciben sin quedar en NULL, y el código
-- está escrito para funcionar ANTES y DESPUÉS de esta migración — selecciona
-- `*` y ordena en memoria solo si la fecha viene. O sea: si esta migración se
-- corre tarde, los favoritos ya funcionan; solo salen en orden arbitrario.
-- ============================================================

ALTER TABLE public.favourite
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- No se añade índice por `client_id`: `uq_favourite` ya es un btree sobre
-- (client_id, pawwer_id), y Postgres usa el prefijo izquierdo de un índice
-- compuesto. La consulta de /mis-favoritos —«dame los míos»— ya va indexada.

-- ── Verificación · la forma final de la tabla ─────────────────────
-- Esperado: id, client_id, pawwer_id, created_at
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'favourite'
ORDER  BY ordinal_position;
