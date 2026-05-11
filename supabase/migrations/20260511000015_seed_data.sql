-- 015: Datos semilla iniciales
-- Crea la región San Martín y el primer usuario superadmin.
-- El superadmin se crea también en auth.users para satisfacer la FK.
-- IMPORTANTE: cambiar la contraseña del superadmin desde Supabase Dashboard
-- (Authentication > Users > admin@miskigo.com) antes de usar en producción.

-- 1. Región San Martín (primera región operativa)
INSERT INTO public.regions (name, city, department, country, is_active)
VALUES ('San Martín', 'Tarapoto', 'San Martín', 'PE', true)
ON CONFLICT DO NOTHING;

-- 2. Superadmin inicial
DO $$
DECLARE
  v_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Primero en auth.users (requerido por FK en public.users)
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  ) VALUES (
    v_id,
    'authenticated',
    'authenticated',
    'admin@miskigo.com',
    extensions.crypt('MiskiAdmin2026!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false,
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

  -- Luego el perfil en public.users
  INSERT INTO public.users (id, email, full_name, role, status)
  VALUES (v_id, 'admin@miskigo.com', 'Superadmin Miski GO', 'superadmin', 'active')
  ON CONFLICT (id) DO NOTHING;
END $$;
