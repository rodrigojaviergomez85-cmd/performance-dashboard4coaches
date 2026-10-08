CREATE TABLE public.qa_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_periods_rango_valido CHECK (end_date >= start_date),
  CONSTRAINT qa_periods_sin_solape EXCLUDE USING gist (daterange(start_date, end_date, '[]') WITH &&)
);
GRANT SELECT, INSERT, UPDATE ON public.qa_periods TO authenticated;
GRANT ALL ON public.qa_periods TO service_role;
ALTER TABLE public.qa_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_periods_lectura ON public.qa_periods FOR SELECT TO authenticated
  USING (public.tiene_rol(ARRAY['revisor','admin']));
CREATE POLICY qa_periods_insert ON public.qa_periods FOR INSERT TO authenticated
  WITH CHECK (public.tiene_rol(ARRAY['admin']));
CREATE POLICY qa_periods_update ON public.qa_periods FOR UPDATE TO authenticated
  USING (public.tiene_rol(ARRAY['admin'])) WITH CHECK (public.tiene_rol(ARRAY['admin']));