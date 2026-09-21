-- Tablas académicas. Ninguna se consulta desde el navegador: RLS activo sin
-- políticas de cliente, toda lectura y escritura pasa por funciones de servidor.

CREATE TABLE public.qa_evals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_id bigint NOT NULL UNIQUE,
  clase text,
  clase_date date,
  schedule text,
  eval_by text,
  coach_id bigint,
  coach text,
  syllabus text,
  level text,
  week integer,
  score numeric,
  comments text,
  applicable integer NOT NULL DEFAULT 1,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dsat_evals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  period_month date,
  class_id integer,
  teacher_id integer,
  teacher_name text,
  syllabus text,
  level text,
  schedule text,
  status text,
  razon_no_cuenta text,
  experience_comment text,
  coach_score numeric,
  coach_comment text,
  applicable integer NOT NULL DEFAULT 1,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nl_evals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  class_id integer NOT NULL,
  syllabus text,
  coach_id integer,
  coach text,
  horario text,
  level text,
  student_id bigint,
  student text,
  evaluator text,
  resultado text,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.abs_incidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  class_id integer NOT NULL,
  syllabus text,
  horario text,
  level text,
  coach_id integer,
  coach text,
  applicable integer NOT NULL DEFAULT 1,
  creado timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, fecha)
);

CREATE TABLE public.lateness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  teacher_id integer,
  teacher_name text,
  coordinator text,
  senior text,
  late_count integer NOT NULL DEFAULT 1,
  creado timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, fecha)
);

CREATE INDEX qa_evals_coach_fecha_idx ON public.qa_evals (coach_id, clase_date);
CREATE INDEX dsat_evals_teacher_mes_idx ON public.dsat_evals (teacher_id, period_month);
CREATE UNIQUE INDEX dsat_evals_token_clave_idx ON public.dsat_evals (token, class_id, teacher_id, period_month);
CREATE INDEX nl_evals_coach_fecha_idx ON public.nl_evals (coach_id, fecha);
CREATE UNIQUE INDEX nl_evals_clave_idx ON public.nl_evals (class_id, fecha, student_id, evaluator);
CREATE INDEX abs_incidencias_coach_fecha_idx ON public.abs_incidencias (coach_id, fecha);
CREATE INDEX lateness_teacher_fecha_idx ON public.lateness (teacher_id, fecha);

GRANT ALL ON public.qa_evals TO service_role;
GRANT ALL ON public.dsat_evals TO service_role;
GRANT ALL ON public.nl_evals TO service_role;
GRANT ALL ON public.abs_incidencias TO service_role;
GRANT ALL ON public.lateness TO service_role;

ALTER TABLE public.qa_evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsat_evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nl_evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abs_incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lateness ENABLE ROW LEVEL SECURITY;

CREATE POLICY sin_lectura_directa_qa ON public.qa_evals FOR SELECT USING (false);
CREATE POLICY sin_lectura_directa_dsat ON public.dsat_evals FOR SELECT USING (false);
CREATE POLICY sin_lectura_directa_nl ON public.nl_evals FOR SELECT USING (false);
CREATE POLICY sin_lectura_directa_abs ON public.abs_incidencias FOR SELECT USING (false);
CREATE POLICY sin_lectura_directa_lateness ON public.lateness FOR SELECT USING (false);