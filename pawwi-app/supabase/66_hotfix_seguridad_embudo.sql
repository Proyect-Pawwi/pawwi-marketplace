-- ============================================================
-- PAWWI — 🔒 HOTFIX de seguridad del embudo
-- Correr en Supabase SQL Editor después de 65_privacidad_direccion.sql
--
-- ⚠️ ESTO NO ES UN SPRINT: es una vulnerabilidad viva. Va antes que nada.
--
-- ── EL AGUJERO ────────────────────────────────────────────────
-- set_pawwer_exam_result y set_pawwer_capacitacion_result son SECURITY
-- DEFINER, reciben del CLIENTE el resultado que deben escribir, y **no tienen
-- GRANT ni REVOKE**, así que conservan el `EXECUTE TO PUBLIC` por defecto de
-- Postgres. Cualquier Pawwer autenticado puede llamarlas por REST:
--
--   POST /rest/v1/rpc/set_pawwer_capacitacion_result
--   { "p_score": 27, "p_passed": true }
--
-- y saltarse la capacitación entera. Igual con el examen. Los server actions
-- recalculan bien el puntaje (app/actions/capacitacion.ts:36-38 y
-- pawwer-exam.ts:39-40), pero eso es evitable saltándose el server action —
-- que es exactamente el agujero.
--
-- Esto ataca la ÚNICA promesa que Pawwi hace: la verificación.
--
-- La mig 44 dice cerrar «pawwer → auto-aprobarse» (su línea 9), pero revocó la
-- escritura A LA TABLA, no estas funciones.
--
-- ── POR QUÉ NO SE RECALCULA DENTRO DE LA FUNCIÓN ──────────────
-- Sería lo ideal, y no se puede:
--   • capacitacion_results NO guarda las respuestas, solo el puntaje
--     (supabase/13_capacitacion.sql:8-16). No hay nada que recalcular.
--   • exam_results sí las guarda, pero la clave de respuestas vive en
--     lib/exam-pawwer.ts. Duplicarla en SQL crearía dos fuentes de verdad
--     para la misma pregunta — peor que el problema que resuelve.
--
-- La corrección es mover la frontera: **estas funciones pasan a ser solo de
-- service_role**. El único que puede llamarlas es el servidor, y el servidor
-- ya deriva la identidad de la sesión y recalcula el puntaje.
--
-- Como auth.uid() es NULL bajo service_role, ahora reciben p_pawwer_id
-- explícito. El server action lo saca de getUser(), nunca del formulario.
-- ============================================================

BEGIN;

-- ── 1. El examen ──────────────────────────────────────────────
-- La firma cambia, así que CREATE OR REPLACE crearía una SOBRECARGA y la
-- versión vieja —la insegura— seguiría viva y accesible. Hay que eliminarla.
DROP FUNCTION IF EXISTS public.set_pawwer_exam_result(text);

CREATE OR REPLACE FUNCTION public.set_pawwer_exam_result(
  p_pawwer_id uuid,
  p_result    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_result NOT IN ('preselected', 'needs_review', 'rejected') THEN
    RAISE EXCEPTION 'Resultado inválido: %', p_result;
  END IF;

  UPDATE public.pawwer
  SET status = p_result
  WHERE id = p_pawwer_id
    AND status = 'exam_ready';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pawwer no encontrado o estado inválido';
  END IF;
END;
$$;

REVOKE ALL   ON FUNCTION public.set_pawwer_exam_result(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_pawwer_exam_result(uuid, text) TO service_role;

-- ── 2. La capacitación ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_pawwer_capacitacion_result(integer, boolean);

CREATE OR REPLACE FUNCTION public.set_pawwer_capacitacion_result(
  p_pawwer_id uuid,
  p_score     integer,
  p_passed    boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.capacitacion_results (pawwer_id, user_id, score, total, passed)
  VALUES (p_pawwer_id, p_pawwer_id, p_score, 27, p_passed);

  IF p_passed THEN
    UPDATE public.pawwer
    SET status = 'visita_pendiente'
    WHERE id = p_pawwer_id
      AND status = 'preselected';
  END IF;
END;
$$;

REVOKE ALL   ON FUNCTION public.set_pawwer_capacitacion_result(uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_pawwer_capacitacion_result(uuid, integer, boolean) TO service_role;

-- ── 3. La visita domiciliaria no estaba blindada ──────────────
-- Su policy es FOR ALL USING (pawwer_id = auth.uid()) y la tabla NO aparece en
-- el REVOKE de la mig 44. El Pawwer puede marcarse la visita como 'completed',
-- cambiarle la fecha, o borrarla y reagendar saltándose la RPC — que es la que
-- comprueba que el cupo esté libre.
--
-- schedule_visita_domiciliaria es SECURITY DEFINER, así que sigue funcionando.
REVOKE INSERT, UPDATE, DELETE ON public.visita_domiciliaria FROM authenticated, anon;

-- ── 4. Las fotos de cédula no se estaban guardando ────────────
-- El server action las escribía con un UPDATE directo a `pawwer`
-- (app/actions/pawwer.ts:117-120), que la mig 44 revoca a `authenticated` — y
-- además ignoraba el error. Fallaba en silencio. Entran por el RPC.
--
-- La firma gana dos parámetros → misma trampa de la sobrecarga que arriba.
DROP FUNCTION IF EXISTS public.complete_pawwer_onboarding(
  text, text, text, double precision, double precision, jsonb, jsonb, text,
  integer, text, text[], text, text[], date, boolean, text, text);

CREATE OR REPLACE FUNCTION public.complete_pawwer_onboarding(
  p_bio              text,
  p_profession       text,
  p_neighborhood     text,
  p_lat              double precision,
  p_lng              double precision,
  p_week_pattern     jsonb,
  p_services         jsonb,
  p_cedula           text          DEFAULT '',
  p_transport_price  integer       DEFAULT 0,
  p_experiencia      text          DEFAULT '',
  p_animales_en_casa text[]        DEFAULT '{}',
  p_tipo_inmueble    text          DEFAULT '',
  p_areas_externas   text[]        DEFAULT '{}',
  p_fecha_nacimiento date          DEFAULT NULL,
  p_ninos_pequenos   boolean       DEFAULT false,
  p_mi_espacio       text          DEFAULT '',
  p_valores          text          DEFAULT '',
  -- Las rutas de la cédula entran AQUÍ. Antes se escribían con un UPDATE
  -- directo desde el server action, que la mig 44 revoca a `authenticated`:
  -- fallaba en silencio y las fotos nunca se guardaban.
  p_cedula_front_url text          DEFAULT NULL,
  p_cedula_back_url  text          DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pawwer_id   uuid := auth.uid();
  v_role        text;
  v_dow_names   text[] := ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  v_first_price numeric;
  v_svc         jsonb;
BEGIN
  IF v_pawwer_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_role FROM public.profile WHERE id = v_pawwer_id;
  IF v_role IS DISTINCT FROM 'pawwer' THEN
    RAISE EXCEPTION 'Solo cuentas Pawwer pueden completar este onboarding';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pawwer WHERE id = v_pawwer_id) THEN
    RAISE EXCEPTION 'Ya completaste tu onboarding';
  END IF;

  IF jsonb_array_length(p_services) < 1 THEN
    RAISE EXCEPTION 'Selecciona al menos un servicio';
  END IF;

  IF p_fecha_nacimiento IS NOT NULL
     AND p_fecha_nacimiento > current_date - INTERVAL '18 years' THEN
    RAISE EXCEPTION 'Debes ser mayor de 18 años para ser Pawwer';
  END IF;

  SELECT (p_services->0->>'price')::numeric INTO v_first_price;

  INSERT INTO public.pawwer (
    id, bio, profession, neighborhood, lat, lng, week_pattern, price,
    cedula, transport_price, experiencia, animales_en_casa, tipo_inmueble, areas_externas,
    fecha_nacimiento, ninos_pequenos, mi_espacio, valores,
    cedula_front_url, cedula_back_url
  ) VALUES (
    v_pawwer_id, p_bio, p_profession, p_neighborhood, p_lat, p_lng, p_week_pattern,
    COALESCE(v_first_price, 0),
    p_cedula, p_transport_price, p_experiencia, p_animales_en_casa, p_tipo_inmueble, p_areas_externas,
    p_fecha_nacimiento, p_ninos_pequenos, p_mi_espacio, p_valores,
    p_cedula_front_url, p_cedula_back_url
  );

  FOR v_svc IN SELECT * FROM jsonb_array_elements(p_services)
  LOOP
    INSERT INTO public."service_X_Pawwer" (id_pawwer, id_service, price, is_active)
    VALUES (v_pawwer_id, (v_svc->>'service_id')::int, (v_svc->>'price')::numeric, true);
  END LOOP;

  -- slots_total lo añadió la mig 63 y este INSERT no lo conocía: un Pawwer
  -- nuevo nacía con la ocupación del día sin calcular («1 de NULL»).
  INSERT INTO public.availability (pawwer_id, date, slots_total, slots_remaining)
  SELECT v_pawwer_id, d::date, 1, 1
  FROM generate_series(current_date, current_date + 60, '1 day') d
  WHERE COALESCE(
    (p_week_pattern->>(v_dow_names[EXTRACT(DOW FROM d)::int + 1]))::boolean,
    false
  )
  ON CONFLICT (pawwer_id, date) DO NOTHING;
END;
$$;

COMMIT;

-- ── Verificación ───────────────────────────────────────────────
--   select
--     (select count(*) from pg_proc where proname='set_pawwer_exam_result')          as firmas_examen,
--     (select count(*) from pg_proc where proname='set_pawwer_capacitacion_result')  as firmas_capacit,
--     (select count(*) from pg_proc where proname='complete_pawwer_onboarding')      as firmas_onboarding,
--     has_function_privilege('authenticated',
--       'public.set_pawwer_capacitacion_result(uuid,integer,boolean)', 'EXECUTE')    as capacit_publica,
--     has_function_privilege('authenticated',
--       'public.set_pawwer_exam_result(uuid,text)', 'EXECUTE')                       as examen_publica,
--     has_table_privilege('authenticated','public.visita_domiciliaria','UPDATE')     as visita_escribible;
--   -- esperado: 1 · 1 · 1 · false · false · false
