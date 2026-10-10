CREATE TABLE public.retencion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  coach_id integer NOT NULL,
  coach text,
  country text,
  sucursal text,
  do_count numeric,
  active_students numeric,
  do_pct numeric,
  retention_pct numeric,
  fc_do numeric,
  fc_do_pct numeric,
  clv numeric,
  category text,
  creado timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retencion_coach_mes UNIQUE (coach_id, period_month)
);
GRANT ALL ON public.retencion TO service_role;
ALTER TABLE public.retencion ENABLE ROW LEVEL SECURITY;
CREATE POLICY sin_lectura_directa_retencion ON public.retencion FOR SELECT USING (false);

CREATE OR REPLACE FUNCTION public.cargar_academico(_tabla text, _filas jsonb, _reemplazar boolean, _desde date, _hasta date, _actor uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _nombre text; _fecha text; _clave text[]; _cols text; _cond text; _filtro text := '';
  _borradas int := 0; _insertadas int := 0; _total int;
BEGIN
  CASE _tabla
    WHEN 'qa' THEN _nombre := 'qa_evaluaciones'; _fecha := 'fecha_monitoreo';
      _clave := ARRAY['clave','coach_id','fecha_monitoreo','type_qa'];
    WHEN 'dsat' THEN _nombre := 'csat_respuestas'; _fecha := 'period_month'; _clave := NULL;
    WHEN 'nl' THEN _nombre := 'nl_evals'; _fecha := 'fecha'; _clave := NULL;
    WHEN 'abs' THEN _nombre := 'incidencias'; _fecha := 'fecha'; _clave := NULL;
    WHEN 'lateness' THEN _nombre := 'lateness'; _fecha := 'fecha'; _clave := NULL;
    WHEN 'retention' THEN _nombre := 'retencion'; _fecha := 'period_month'; _clave := NULL;
    ELSE RAISE EXCEPTION 'Tabla no permitida: %', _tabla;
  END CASE;

  IF _desde IS NULL OR _hasta IS NULL OR _desde > _hasta THEN
    RAISE EXCEPTION 'Rango de fechas inválido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cargar_academico:' || _nombre));
  _total := jsonb_array_length(_filas);

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO _cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = _nombre AND column_name NOT IN ('id', 'creado');

  IF _clave IS NOT NULL THEN
    SELECT string_agg(format('t.%1$I IS NOT DISTINCT FROM r.%1$I', c), ' AND ') INTO _cond
    FROM unnest(_clave) AS c;
    _filtro := format(' WHERE NOT EXISTS (SELECT 1 FROM public.%I t WHERE %s)', _nombre, _cond);
  END IF;

  IF _reemplazar THEN
    EXECUTE format('DELETE FROM public.%I WHERE %I BETWEEN $1 AND $2', _nombre, _fecha)
      USING _desde, _hasta;
    GET DIAGNOSTICS _borradas = ROW_COUNT;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) r%3$s ON CONFLICT DO NOTHING',
    _nombre, _cols, _filtro)
    USING _filas;
  GET DIAGNOSTICS _insertadas = ROW_COUNT;

  INSERT INTO public.auditoria (actor_id, accion, detalle) VALUES (
    _actor, 'carga_academica',
    jsonb_build_object('tabla', _nombre, 'insertadas', _insertadas, 'omitidas', _total - _insertadas,
      'borradas', _borradas, 'desde', _desde, 'hasta', _hasta, 'reemplazar', _reemplazar));

  RETURN jsonb_build_object('insertadas', _insertadas, 'omitidas', _total - _insertadas, 'borradas', _borradas);
END;
$function$;
REVOKE ALL ON FUNCTION public.cargar_academico(text, jsonb, boolean, date, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cargar_academico(text, jsonb, boolean, date, date, uuid) TO service_role;