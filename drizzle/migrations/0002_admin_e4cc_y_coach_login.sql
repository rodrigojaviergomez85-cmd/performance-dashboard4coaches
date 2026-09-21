INSERT INTO public.coaches (coach_id, nombre, email, rol, activo, auth_user_id)
VALUES (0, 'Administración E4CC', 'admin.e4cc@e4cc.local', 'admin', true, 'cacd6a8d-45c9-4104-90b5-e3d67e93c7d2')
ON CONFLICT (email) DO UPDATE
  SET rol = 'admin', activo = true, auth_user_id = EXCLUDED.auth_user_id;

DELETE FROM public.coaches WHERE email = 'admin@english4kids.com' AND auth_user_id IS NULL;