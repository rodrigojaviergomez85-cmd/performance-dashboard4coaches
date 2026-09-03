REVOKE ALL ON FUNCTION public.tiene_rol(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiene_rol(text[]) TO authenticated, service_role;
