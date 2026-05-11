-- ================================================================
-- 003 — product_categories & products
-- Solo superadmin crea categorías y productos en MVP
-- ================================================================

-- ─── Table: product_categories ────────────────────────────────────

CREATE TABLE public.product_categories (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text         NOT NULL,
  slug                 text         UNIQUE NOT NULL,
  operational_cost_pct numeric(5,2) NOT NULL CHECK (operational_cost_pct > 0 AND operational_cost_pct < 1),
  suggested_margin_pct numeric(5,2) NOT NULL CHECK (suggested_margin_pct > 0 AND suggested_margin_pct < 1),
  estimated_waste_pct  numeric(5,2) NOT NULL CHECK (estimated_waste_pct >= 0 AND estimated_waste_pct < 1),
  is_active            boolean      NOT NULL DEFAULT true,
  created_at           timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_select"
  ON public.product_categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "product_categories_insert"
  ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'superadmin');

CREATE POLICY "product_categories_update"
  ON public.product_categories FOR UPDATE TO authenticated
  USING  (public.get_user_role() = 'superadmin')
  WITH CHECK (public.get_user_role() = 'superadmin');

-- ─── Table: products ──────────────────────────────────────────────

CREATE TABLE public.products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid        NOT NULL REFERENCES public.product_categories(id),
  name        text        NOT NULL,
  slug        text        UNIQUE NOT NULL,
  description text,
  unit        text        NOT NULL CHECK (unit IN ('kg','unit','liter','bunch')),
  image_url   text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_is_active   ON public.products(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_slug        ON public.products(slug);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados ven el catálogo (no mostrar eliminados)
CREATE POLICY "products_select"
  ON public.products FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "products_insert"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'superadmin');

CREATE POLICY "products_update"
  ON public.products FOR UPDATE TO authenticated
  USING  (public.get_user_role() = 'superadmin')
  WITH CHECK (public.get_user_role() = 'superadmin');
