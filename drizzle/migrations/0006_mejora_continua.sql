CREATE TABLE public.materiales_mejora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  mes date NOT NULL,
  tipo text NOT NULL DEFAULT 'documento',
  ruta text NOT NULL,
  nombre_archivo text NOT NULL,
  mime text,
  tamano bigint,
  subido_por uuid,
  creado timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiales_mejora TO authenticated;
GRANT ALL ON public.materiales_mejora TO service_role;
ALTER TABLE public.materiales_mejora ENABLE ROW LEVEL SECURITY;
CREATE POLICY mejora_lectura ON public.materiales_mejora FOR SELECT TO authenticated USING (true);
CREATE POLICY mejora_insert ON public.materiales_mejora FOR INSERT TO authenticated WITH CHECK (public.tiene_rol(ARRAY['admin']));
CREATE POLICY mejora_delete ON public.materiales_mejora FOR DELETE TO authenticated USING (public.tiene_rol(ARRAY['admin']));
CREATE INDEX materiales_mejora_mes_idx ON public.materiales_mejora (mes);

CREATE POLICY mejora_obj_lectura ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mejora-continua');
CREATE POLICY mejora_obj_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mejora-continua' AND public.tiene_rol(ARRAY['admin']));
CREATE POLICY mejora_obj_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mejora-continua' AND public.tiene_rol(ARRAY['admin']));