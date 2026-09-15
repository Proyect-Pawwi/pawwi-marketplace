-- ============================================================
-- PAWWI — Quitar la clave foránea DUPLICADA de service_X_Pawwer → service_type
-- Correr en Supabase SQL Editor después de 69_grants_dog.sql
--
-- Síntoma (2026-09-15): en el wizard de reserva, elegir fecha y darle a
--   «Agendar» devolvía al home sin ningún mensaje.
--
-- Causa: existen DOS claves foráneas sobre exactamente las mismas columnas,
--   service_X_Pawwer(id_service) → service_type(id):
--     • fk_service_x_pawwer_service_type
--     • service_X_Pawwer_id_service_fkey
--   Con dos caminos posibles, PostgREST no sabe cuál usar al hacer un embed sin
--   nombrarla, responde 300 (PGRST201) y devuelve data = null:
--     "Could not embed because more than one relationship was found
--      for 'service_X_Pawwer' and 'service_type'"
--   El paso 1 del wizard hacía `service_type ( id, name )` sin nombre de FK, así
--   que `pawwer` salía null y el guard `if (!pawwer) redirect("/")` rebotaba al
--   home — sin mirar el error. El paso 3 tenía el mismo embed.
--
-- Ya había mordido antes: `perfil/tarifas/page.tsx` lo esquivó con un mapa
--   `NAME_BY_ID` fijo y dejó escrito el porqué —«sin el hint de FK es ambiguo y
--   PostgREST devuelve error (data=null) → la lista salía vacía»—. Se documentó
--   el síntoma y se rodeó la causa; aquí se quita la causa.
--
-- Fix: eliminar la REDUNDANTE y conservar `fk_service_x_pawwer_service_type`,
--   que es la que el código ya nombra en app/page.tsx, en el perfil público y
--   en el wizard. No se pierde integridad referencial: la que queda impone
--   exactamente la misma regla sobre las mismas columnas.
-- ============================================================

ALTER TABLE public."service_X_Pawwer"
  DROP CONSTRAINT IF EXISTS "service_X_Pawwer_id_service_fkey";

-- ── Verificación ──────────────────────────────────────────────
-- Esperado: UNA sola fila → fk_service_x_pawwer_service_type
SELECT con.conname AS restriccion,
       pg_get_constraintdef(con.oid) AS definicion
FROM   pg_constraint con
JOIN   pg_class rel ON rel.oid = con.conrelid
WHERE  rel.relname = 'service_X_Pawwer'
  AND  con.contype = 'f'
  AND  con.confrelid = 'public.service_type'::regclass
ORDER  BY con.conname;

-- ── ¿Hay más FKs duplicadas escondidas? ───────────────────────
-- Misma tabla origen, mismas columnas y mismo destino, más de una vez.
-- Esperado tras esta migración: cero filas. Si sale alguna, es la próxima
-- que va a romper un embed sin previo aviso.
SELECT rel.relname       AS tabla,
       con.conkey        AS columnas,
       frel.relname      AS destino,
       count(*)          AS n_fks,
       string_agg(con.conname, ' · ' ORDER BY con.conname) AS nombres
FROM   pg_constraint con
JOIN   pg_class rel  ON rel.oid  = con.conrelid
JOIN   pg_class frel ON frel.oid = con.confrelid
JOIN   pg_namespace n ON n.oid = rel.relnamespace
WHERE  con.contype = 'f' AND n.nspname = 'public'
GROUP  BY rel.relname, con.conkey, frel.relname
HAVING count(*) > 1
ORDER  BY rel.relname;
