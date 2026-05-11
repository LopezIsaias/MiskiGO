-- ================================================================
-- 001 — regions & users
-- Incluye funciones helper de RLS y triggers compartidos
-- ================================================================

-- ─── Triggers compartidos ─────────────────────────────────────────

-- Auto-actualiza updated_at en cualquier tabla que lo use
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Impide UPDATE y DELETE en tablas inmutables (audit_log, wallet_transactions)
-- Se dispara incluso para el service role, garantizando integridad a nivel de BD
CREATE OR REPLACE FUNCTION public.raise_immutable_error()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Esta tabla es inmutable. Las modificaciones no están permitidas.';
END;
$$;

-- ─── Table: regions ───────────────────────────────────────────────

CREATE TABLE public.regions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  city        text        NOT NULL,
  department  text        NOT NULL,
  country     text        NOT NULL DEFAULT 'PE',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Table: users ─────────────────────────────────────────────────
-- Extiende auth.users de Supabase. wallet_balance se modifica SOLO via wallet_transactions.

CREATE TABLE public.users (
  id               uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text          UNIQUE NOT NULL,
  phone            text,
  full_name        text          NOT NULL,
  dni              text          UNIQUE,
  ruc              text          UNIQUE,
  role             text          NOT NULL
                                 CHECK (role IN ('superadmin','region_operator','operator','delivery','supplier','customer')),
  region_id        uuid          REFERENCES public.regions(id),
  reputation_score integer       NOT NULL DEFAULT 100,
  status           text          NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active','suspended','deleted')),
  wallet_balance   numeric(10,2) NOT NULL DEFAULT 0
                                 CHECK (wallet_balance >= 0),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX idx_users_role      ON public.users(role);
CREATE INDEX idx_users_region_id ON public.users(region_id);
CREATE INDEX idx_users_status    ON public.users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_dni       ON public.users(dni)    WHERE dni IS NOT NULL;
CREATE INDEX idx_users_ruc       ON public.users(ruc)    WHERE ruc IS NOT NULL;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Helpers de RLS ───────────────────────────────────────────────
-- SECURITY DEFINER: evita recursión infinita al consultar users desde políticas de users.
-- SET search_path: previene ataques de search path hijacking.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_region_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT region_id FROM public.users WHERE id = auth.uid()
$$;

-- ─── RLS: regions ─────────────────────────────────────────────────

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regions_select"
  ON public.regions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "regions_insert"
  ON public.regions FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'superadmin');

CREATE POLICY "regions_update"
  ON public.regions FOR UPDATE TO authenticated
  USING  (public.get_user_role() = 'superadmin')
  WITH CHECK (public.get_user_role() = 'superadmin');

-- ─── RLS: users ───────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve su propio registro; roles de staff ven todos los activos
CREATE POLICY "users_select"
  ON public.users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- supplier y customer se auto-registran (id debe coincidir con auth.uid())
-- superadmin crea cualquier rol desde el panel
CREATE POLICY "users_insert"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'superadmin'
    OR (auth.uid() = id AND role IN ('supplier','customer'))
  );

-- superadmin actualiza cualquier perfil; supplier/customer solo su propio perfil
-- wallet_balance se cambia solo por superadmin (operador propone, superadmin aprueba)
CREATE POLICY "users_update"
  ON public.users FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'superadmin'
    OR (id = auth.uid() AND public.get_user_role() IN ('supplier','customer'))
  )
  WITH CHECK (
    public.get_user_role() = 'superadmin'
    OR (id = auth.uid() AND public.get_user_role() IN ('supplier','customer'))
  );
