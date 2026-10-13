CREATE TABLE public.hires (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('hire','meta')),
  period_month date NOT NULL,
  coach_id integer NOT NULL,
  coach text,
  student_id bigint,
  student text,
  categoria text,
  es_2m boolean NOT NULL DEFAULT false,
  meta numeric,
  fecha_reportado timestamptz,
  location text,
  country text,
  creado timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hires TO service_role;
ALTER TABLE public.hires ENABLE ROW LEVEL SECURITY;
CREATE POLICY sin_lectura_directa_hires ON public.hires FOR SELECT USING (false);
CREATE UNIQUE INDEX hires_unico_hire ON public.hires (period_month, coach_id, student_id) WHERE tipo = 'hire';
CREATE UNIQUE INDEX hires_unico_meta ON public.hires (period_month, coach_id) WHERE tipo = 'meta';
CREATE INDEX hires_coach_mes ON public.hires (coach_id, period_month);

CREATE OR REPLACE FUNCTION public.cargar_academico(_tabla text, _filas jsonb, _reemplazar boolean, _desde date, _hasta date, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _nombre text; _fecha text; _cols text;
  _borradas int := 0; _insertadas int := 0; _total int;
BEGIN
  CASE _tabla
    WHEN 'qa' THEN _nombre := 'qa_evaluaciones'; _fecha := 'fecha_ingresado';
    WHEN 'dsat' THEN _nombre := 'csat_respuestas'; _fecha := 'period_month';
    WHEN 'nl' THEN _nombre := 'nl_evals'; _fecha := 'fecha';
    WHEN 'abs' THEN _nombre := 'incidencias'; _fecha := 'fecha';
    WHEN 'lateness' THEN _nombre := 'lateness'; _fecha := 'fecha';
    WHEN 'retention' THEN _nombre := 'retencion'; _fecha := 'period_month';
    WHEN 'hires' THEN _nombre := 'hires'; _fecha := 'period_month';
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

  IF _reemplazar THEN
    EXECUTE format('DELETE FROM public.%I WHERE %I BETWEEN $1 AND $2', _nombre, _fecha)
      USING _desde, _hasta;
    GET DIAGNOSTICS _borradas = ROW_COUNT;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) r ON CONFLICT DO NOTHING',
    _nombre, _cols)
    USING _filas;
  GET DIAGNOSTICS _insertadas = ROW_COUNT;

  INSERT INTO public.auditoria (actor_id, accion, detalle) VALUES (
    _actor, 'carga_academica',
    jsonb_build_object('tabla', _nombre, 'insertadas', _insertadas, 'omitidas', _total - _insertadas,
      'borradas', _borradas, 'desde', _desde, 'hasta', _hasta, 'reemplazar', _reemplazar));

  RETURN jsonb_build_object('insertadas', _insertadas, 'omitidas', _total - _insertadas, 'borradas', _borradas);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.cargar_academico(text, jsonb, boolean, date, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cargar_academico(text, jsonb, boolean, date, date, uuid) TO service_role;