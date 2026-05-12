-- 017: GRANTs de PostgREST + ajuste de política pública de regions + limpieza superadmin
--
-- CONTEXTO: "Automatically expose new tables" estaba desactivado en el proyecto Supabase.
-- Las tablas creadas en migraciones previas no tienen GRANT a ningún rol de PostgREST.
-- Sin estos GRANTs, todas las queries de la app retornan "permission denied".

-- ─── 1. Acceso al schema public ──────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ─── 2. service_role: acceso completo (necesario para el cliente admin) ──────

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ─── 3. authenticated: operaciones CRUD (RLS restringe por fila) ──────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ─── 4. anon: solo lectura pública mínima ────────────────────────────────────
-- regions: necesario para la página de registro (sin sesión de usuario)

GRANT SELECT ON public.regions TO anon;

-- ─── 5. Defaults para tablas futuras ─────────────────────────────────────────

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;

-- ─── 6. Política regions_select: también permite lectura a anon ──────────────
-- La página /register es un Server Component sin sesión → usa rol anon.
-- Sin este permiso, el selector de región aparece vacío.

DROP POLICY IF EXISTS "regions_select" ON public.regions;
CREATE POLICY "regions_select"
  ON public.regions FOR SELECT TO anon, authenticated
  USING (true);

-- ─── 7. Eliminar superadmin creado manualmente vía SQL (migración 015) ───────
-- El auth user insertado con INSERT directo en auth.users no puede ser gestionado
-- por el Auth Admin API ni su contraseña validada por Supabase Auth.
-- Se elimina para que el script seed:admin lo recree vía Admin API.
-- La fila en public.users se elimina por CASCADE.

DELETE FROM auth.users WHERE email = 'admin@miskigo.com';
