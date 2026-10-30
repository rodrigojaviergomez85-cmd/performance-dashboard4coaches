ALTER TABLE public.retencion ADD COLUMN IF NOT EXISTS niveles jsonb;
COMMENT ON COLUMN public.retencion.clases IS 'DEPRECATED: replaced by niveles (COACH X NIVEL)';