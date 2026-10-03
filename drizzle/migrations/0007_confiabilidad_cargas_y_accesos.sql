-- Unicidad donde los datos existentes lo permiten (verificado: 0 duplicados).
CREATE UNIQUE INDEX IF NOT EXISTS csat_respuestas_clave_uidx
  ON public.csat_respuestas (token, student_id, teacher_id, period_month, submitted_at) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX IF NOT EXISTS incidencias_clave_uidx
  ON public.incidencias (fecha, coach_id, horarios, curso, tipo) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX IF NOT EXISTS nl_evals_clave_uidx
  ON public.nl_evals (class_id, fecha, student_id, evaluator) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX IF NOT EXISTS lateness_clave_uidx
  ON public.lateness (teacher_id, fecha) NULLS NOT DISTINCT;

-- Carga académica atómica: borra el rango e inserta en una sola transacción.
CREATE OR REPLACE FUNCTION public.cargar_academico(
  _tabla text, _filas jsonb, _reemplazar boolean, _desde date, _hasta date, _actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _nombre text; _fecha text; _clave text[]; _cols text; _cond text;
  _borradas int := 0; _insertadas int := 0; _total int;
BEGIN
  CASE _tabla
    WHEN 'qa' THEN _nombre := 'qa_evaluaciones'; _fecha := 'fecha_monitoreo';
      _clave := ARRAY['clave','coach_id','fecha_monitoreo','type_qa'];
    WHEN 'dsat' THEN _nombre := 'csat_respuestas'; _fecha := 'period_month';
      _clave := ARRAY['token','student_id','teacher_id','period_month','submitted_at'];
    WHEN 'nl' THEN _nombre := 'nl_evals'; _fecha := 'fecha';
      _clave := ARRAY['class_id','fecha','student_id','evaluator'];
    WHEN 'abs' THEN _nombre := 'incidencias'; _fecha := 'fecha';
      _clave := ARRAY['fecha','coach_id','horarios','curso','tipo'];
    WHEN 'lateness' THEN _nombre := 'lateness'; _fecha := 'fecha';
      _clave := ARRAY['teacher_id','fecha'];
    ELSE RAISE EXCEPTION 'Tabla no permitida: %', _tabla;
  END CASE;

  IF _desde IS NULL OR _hasta IS NULL OR _desde > _hasta THEN
    RAISE EXCEPTION 'Rango de fechas inválido';
  END IF;

  -- Serializa cargas simultáneas de la misma tabla.
  PERFORM pg_advisory_xact_lock(hashtext('cargar_academico:' || _nombre));

  _total := jsonb_array_length(_filas);

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO _cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = _nombre AND column_name NOT IN ('id', 'creado');

  SELECT string_agg(format('t.%1$I IS NOT DISTINCT FROM r.%1$I', c), ' AND ') INTO _cond
  FROM unnest(_clave) AS c;

  IF _reemplazar THEN
    EXECUTE format('DELETE FROM public.%I WHERE %I BETWEEN $1 AND $2', _nombre, _fecha)
      USING _desde, _hasta;
    GET DIAGNOSTICS _borradas = ROW_COUNT;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) r '
    || 'WHERE NOT EXISTS (SELECT 1 FROM public.%1$I t WHERE %3$s) ON CONFLICT DO NOTHING',
    _nombre, _cols, _cond)
    USING _filas;
  GET DIAGNOSTICS _insertadas = ROW_COUNT;

  INSERT INTO public.auditoria (actor_id, accion, detalle) VALUES (
    _actor, 'carga_academica',
    jsonb_build_object('tabla', _nombre, 'insertadas', _insertadas, 'omitidas', _total - _insertadas,
      'borradas', _borradas, 'desde', _desde, 'hasta', _hasta, 'reemplazar', _reemplazar));

  RETURN jsonb_build_object('insertadas', _insertadas, 'omitidas', _total - _insertadas, 'borradas', _borradas);
END;
$$;
REVOKE ALL ON FUNCTION public.cargar_academico(text, jsonb, boolean, date, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cargar_academico(text, jsonb, boolean, date, date, uuid) TO service_role;

-- Sincronización atómica de coaches: no toca roles, no reactiva, desactiva en vez de borrar.
CREATE OR REPLACE FUNCTION public.sincronizar_coaches(_filas jsonb, _desactivar boolean, _actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _nuevos int := 0; _actualizados int := 0; _desactivados int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sincronizar_coaches'));

  CREATE TEMP TABLE _archivo ON COMMIT DROP AS
  SELECT * FROM jsonb_to_recordset(_filas) AS x(
    coach_id integer, nombre text, email text, pais text, sucursal text, id_coordinador integer,
    coordinador text, estado text, categoria text, tenure text);

  UPDATE public.coaches c SET
    nombre = a.nombre, email = a.email, pais = a.pais, sucursal = a.sucursal,
    id_coordinador = a.id_coordinador, coordinador = a.coordinador, estado = a.estado,
    categoria = a.categoria, tenure = a.tenure
  FROM _archivo a
  WHERE c.coach_id = a.coach_id AND c.rol = 'coach';
  GET DIAGNOSTICS _actualizados = ROW_COUNT;

  INSERT INTO public.coaches (coach_id, nombre, email, pais, sucursal, id_coordinador, coordinador, estado, categoria, tenure, rol, activo)
  SELECT a.coach_id, a.nombre, a.email, a.pais, a.sucursal, a.id_coordinador, a.coordinador, a.estado, a.categoria, a.tenure, 'coach', true
  FROM _archivo a
  WHERE NOT EXISTS (SELECT 1 FROM public.coaches c WHERE c.coach_id = a.coach_id);
  GET DIAGNOSTICS _nuevos = ROW_COUNT;

  IF _desactivar THEN
    UPDATE public.coaches c SET activo = false
    WHERE c.rol = 'coach' AND c.activo = true
      AND NOT EXISTS (SELECT 1 FROM _archivo a WHERE a.coach_id = c.coach_id);
    GET DIAGNOSTICS _desactivados = ROW_COUNT;
  END IF;

  INSERT INTO public.auditoria (actor_id, accion, detalle) VALUES (
    _actor, 'carga_lista_coaches',
    jsonb_build_object('nuevos', _nuevos, 'actualizados', _actualizados, 'desactivados', _desactivados));

  RETURN jsonb_build_object('nuevos', _nuevos, 'actualizados', _actualizados, 'desactivados', _desactivados);
END;
$$;
REVOKE ALL ON FUNCTION public.sincronizar_coaches(jsonb, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_coaches(jsonb, boolean, uuid) TO service_role;

-- Límite de solicitudes de código, atómico ante concurrencia.
CREATE OR REPLACE FUNCTION public.registrar_intento_otp(_email text, _limite integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('otp:' || _email));
  SELECT count(*) INTO _n FROM public.otp_intentos
  WHERE email = _email AND creado >= now() - interval '1 hour';
  IF _n >= _limite THEN RETURN false; END IF;
  INSERT INTO public.otp_intentos (email) VALUES (_email);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_intento_otp(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_intento_otp(text, integer) TO service_role;

-- Mejora Continua: solo usuarios vinculados a un coach activo leen; solo admins activos escriben.
DROP POLICY IF EXISTS mejora_lectura ON public.materiales_mejora;
CREATE POLICY mejora_lectura ON public.materiales_mejora FOR SELECT TO authenticated
  USING (public.tiene_rol(ARRAY['coach', 'revisor', 'admin']));

DROP POLICY IF EXISTS mejora_obj_lectura ON storage.objects;
CREATE POLICY mejora_obj_lectura ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mejora-continua' AND public.tiene_rol(ARRAY['coach', 'revisor', 'admin']));

DROP POLICY IF EXISTS mejora_obj_insert ON storage.objects;
CREATE POLICY mejora_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mejora-continua'
    AND public.tiene_rol(ARRAY['admin'])
    AND lower(storage.extension(name)) = ANY (ARRAY[
      'pdf','png','jpg','jpeg','gif','webp','mp4','webm','mov','m4v','mp3','m4a','wav',
      'doc','docx','ppt','pptx','xls','xlsx','txt','csv'])
  );