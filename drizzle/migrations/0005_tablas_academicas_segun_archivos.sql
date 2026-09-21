-- QA segun el archivo QA_FINAL
CREATE TABLE public.qa_evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text,
  week text,
  clave text,
  pais text,
  sucursal text,
  quality_type text,
  gerente text,
  coach_id integer,
  coach text,
  nota_final numeric,
  level text,
  horario text,
  fecha_ingresado date,
  type_monitoreo text,
  fecha_monitoreo date NOT NULL,
  evaluating_time numeric,
  area_mejora text,
  type_qa text,
  gerente2 text,
  nota_suc numeric,
  feedback_type text,
  comentario text,
  applicable integer NOT NULL DEFAULT 1,
  creado timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qa_evaluaciones TO service_role;
ALTER TABLE public.qa_evaluaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY sin_lectura_directa_qa_ev ON public.qa_evaluaciones FOR SELECT USING (false);
CREATE INDEX qa_evaluaciones_coach_fecha_idx ON public.qa_evaluaciones (coach_id, fecha_monitoreo);

-- CSAT segun el archivo CSAT_FINAL (fuente del DSAT)
CREATE TABLE public.csat_respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  submitted_at timestamptz,
  coach_aplica text,
  tenure_aplica text,
  student_id bigint,
  evaluating_coach text,
  diferenciador_coach text,
  tenure text,
  coach_score numeric,
  coach_comment text,
  categoria text,
  sub_categoria text,
  razon_escalar text,
  comment_escalar text,
  aplica_coach text,
  razon_no_aplica text,
  bist_score numeric,
  bist_comment text,
  instalaciones_score numeric,
  instalaciones_comment text,
  experiencia_score numeric,
  experiencia_comment text,
  token text,
  trainee_name text,
  idcontrol bigint,
  pais text,
  sucursal text,
  curso text,
  salon text,
  nivel text,
  horario text,
  coach_asignado text,
  inscritos integer,
  csat_type text,
  teacher_id integer,
  coordinador text,
  linea_negocio text,
  creado timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.csat_respuestas TO service_role;
ALTER TABLE public.csat_respuestas ENABLE ROW LEVEL SECURITY;
CREATE POLICY sin_lectura_directa_csat ON public.csat_respuestas FOR SELECT USING (false);
CREATE INDEX csat_respuestas_coach_mes_idx ON public.csat_respuestas (teacher_id, period_month);

-- Incidencias segun el archivo INCIDENCIAS
CREATE TABLE public.incidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso text,
  sucursal text,
  pais text,
  anio integer,
  fecha date NOT NULL,
  mes text,
  week integer,
  horarios text,
  motivo text,
  otros_motivos text,
  otros_motivos_2 text,
  coordinador text,
  coach_id integer,
  coach_asignado text,
  coach_cubre text,
  horas_asignadas numeric,
  notas text,
  whodidit text,
  fecha_ingreso timestamptz,
  fecha_modificacion timestamptz,
  tipo text,
  applicable integer NOT NULL DEFAULT 1,
  creado timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.incidencias TO service_role;
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY sin_lectura_directa_inc ON public.incidencias FOR SELECT USING (false);
CREATE INDEX incidencias_coach_fecha_idx ON public.incidencias (coach_id, fecha);

COMMENT ON TABLE public.qa_evals IS 'DEPRECATED: reemplazada por public.qa_evaluaciones';
COMMENT ON TABLE public.dsat_evals IS 'DEPRECATED: reemplazada por public.csat_respuestas';
COMMENT ON TABLE public.abs_incidencias IS 'DEPRECATED: reemplazada por public.incidencias';