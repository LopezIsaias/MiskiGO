-- 016: Trigger auth.users → public.users
-- Patrón canónico de Supabase: cuando se crea un usuario en auth.users,
-- automáticamente crea su perfil en public.users leyendo raw_user_meta_data.
-- SECURITY DEFINER permite el INSERT sin importar las políticas RLS del momento.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
BEGIN
  -- Si no hay metadatos de perfil (ej: OAuth sin datos, seeds manuales), no hacer nada.
  -- La seed del superadmin ya tiene su fila en public.users desde la migración 015.
  IF meta IS NULL OR meta->>'full_name' IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    dni,
    ruc,
    region_id,
    role,
    status
  ) VALUES (
    NEW.id,
    NEW.email,
    meta->>'full_name',
    NULLIF(meta->>'phone', ''),
    NULLIF(meta->>'dni',   ''),
    NULLIF(meta->>'ruc',   ''),
    NULLIF(meta->>'region_id', '')::uuid,
    COALESCE(NULLIF(meta->>'role', ''), 'customer'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
