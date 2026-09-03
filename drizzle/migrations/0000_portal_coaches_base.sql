-- ============ TABLAS ============

CREATE TABLE public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id int UNIQUE NOT NULL,
  nombre text NOT NULL,
  email text UNIQUE NOT NULL CHECK (email = lower(email)),
  coordinador text,
  tenure text,
  rol text NOT NULL DEFAULT 'coach' CHECK (rol IN ('coach','revisor','admin')),
  activo boolean NOT NULL DEFAULT true,
  auth_user_id uuid UNIQUE,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.encuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id int NOT NULL,
  periodo text NOT NULL,
  score int NOT NULL CHECK (score BETWEEN 1 AND 10),
  comentario text,
  curso text,
  primera_semana boolean NOT NULL DEFAULT false,
  origen text,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.revisiones (
  encuesta_id uuid PRIMARY KEY REFERENCES public.encuestas(id) ON DELETE CASCADE,
  cuenta boolean NOT NULL DEFAULT true,
  motivo text,
  revisor_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  actualizado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.parametros (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  umbral_superstar numeric NOT NULL DEFAULT 0.06,
  umbral_great numeric NOT NULL DEFAULT 0.12,
  min_encuestas int NOT NULL DEFAULT 20,
  trimestre_activo text
);

CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  accion text NOT NULL,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.otp_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_encuestas_coach_periodo ON public.encuestas (coach_id, periodo);
CREATE INDEX idx_coaches_email ON public.coaches (email);
CREATE INDEX idx_otp_intentos_email_creado ON public.otp_intentos (email, creado);

-- ============ FUNCION DE ROL (security definer) ============

CREATE OR REPLACE FUNCTION public.tiene_rol(_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches
    WHERE auth_user_id = auth.uid()
      AND activo = true
      AND rol = ANY(_roles)
  )
$$;

-- ============ GRANTS ============

GRANT SELECT ON public.coaches TO authenticated;
GRANT ALL ON public.coaches TO service_role;

GRANT ALL ON public.encuestas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisiones TO authenticated;
GRANT ALL ON public.revisiones TO service_role;

GRANT SELECT, UPDATE ON public.parametros TO authenticated;
GRANT ALL ON public.parametros TO service_role;

GRANT SELECT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;

GRANT ALL ON public.otp_intentos TO service_role;

-- ============ RLS ============

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_intentos ENABLE ROW LEVEL SECURITY;

-- encuestas: nadie lee desde el cliente
CREATE POLICY sin_lectura_directa ON public.encuestas FOR SELECT USING (false);

-- coaches
CREATE POLICY coaches_propia_fila ON public.coaches FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY coaches_revisor_admin ON public.coaches FOR SELECT TO authenticated
  USING (public.tiene_rol(ARRAY['revisor','admin']));

-- revisiones
CREATE POLICY revisiones_lectura ON public.revisiones FOR SELECT TO authenticated
  USING (public.tiene_rol(ARRAY['revisor','admin']));
CREATE POLICY revisiones_insert ON public.revisiones FOR INSERT TO authenticated
  WITH CHECK (public.tiene_rol(ARRAY['revisor','admin']));
CREATE POLICY revisiones_update ON public.revisiones FOR UPDATE TO authenticated
  USING (public.tiene_rol(ARRAY['revisor','admin']))
  WITH CHECK (public.tiene_rol(ARRAY['revisor','admin']));
CREATE POLICY revisiones_delete ON public.revisiones FOR DELETE TO authenticated
  USING (public.tiene_rol(ARRAY['revisor','admin']));

-- parametros
CREATE POLICY parametros_lectura ON public.parametros FOR SELECT TO authenticated
  USING (public.tiene_rol(ARRAY['revisor','admin']));
CREATE POLICY parametros_update ON public.parametros FOR UPDATE TO authenticated
  USING (public.tiene_rol(ARRAY['admin']))
  WITH CHECK (public.tiene_rol(ARRAY['admin']));

-- auditoria: solo admin lee
CREATE POLICY auditoria_lectura_admin ON public.auditoria FOR SELECT TO authenticated
  USING (public.tiene_rol(ARRAY['admin']));

-- otp_intentos: sin acceso desde el cliente (solo servidor)

-- ============ DATOS INICIALES ============

INSERT INTO public.parametros (id, umbral_superstar, umbral_great, min_encuestas, trimestre_activo)
VALUES (true, 0.06, 0.12, 20, '2026-Q3');

INSERT INTO public.coaches (coach_id, nombre, email, coordinador, tenure, rol, activo)
VALUES (1, 'Administrador', 'admin@english4kids.com', NULL, NULL, 'admin', true);
