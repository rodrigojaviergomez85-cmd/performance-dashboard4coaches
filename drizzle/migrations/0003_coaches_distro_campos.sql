ALTER TABLE public.coaches DROP CONSTRAINT IF EXISTS coaches_email_key;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS pais text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS sucursal text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS id_coordinador integer;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS categoria text;
CREATE INDEX IF NOT EXISTS coaches_email_idx ON public.coaches (email);