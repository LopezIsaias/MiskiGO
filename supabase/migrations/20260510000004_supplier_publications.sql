-- ================================================================
-- 004 — supplier_publications
-- Algoritmo de asignación (CLAUDE.md § 4):
--   ORDER BY minimum_price ASC, published_at ASC, reputation_score DESC
-- ================================================================

CREATE TABLE public.supplier_publications (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id        uuid          NOT NULL REFERENCES public.users(id),
  product_id         uuid          NOT NULL REFERENCES public.products(id),
  region_id          uuid          NOT NULL REFERENCES public.regions(id),
  available_quantity numeric(10,3) NOT NULL CHECK (available_quantity > 0),
  minimum_price      numeric(10,2) NOT NULL CHECK (minimum_price > 0),
  published_at       timestamptz   NOT NULL DEFAULT now(),
  expires_at         timestamptz   NOT NULL,
  status             text          NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','reserved','fulfilled','expired')),
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_pub_supplier_id ON public.supplier_publications(supplier_id);
CREATE INDEX idx_supplier_pub_product_id  ON public.supplier_publications(product_id);
CREATE INDEX idx_supplier_pub_region_id   ON public.supplier_publications(region_id);
CREATE INDEX idx_supplier_pub_status      ON public.supplier_publications(status);
CREATE INDEX idx_supplier_pub_expires_at  ON public.supplier_publications(expires_at);

-- Índice compuesto optimizado para el algoritmo de asignación automática
CREATE INDEX idx_supplier_pub_assignment
  ON public.supplier_publications(region_id, product_id, minimum_price ASC, published_at ASC)
  WHERE status = 'active';

CREATE TRIGGER supplier_publications_updated_at
  BEFORE UPDATE ON public.supplier_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS: supplier_publications ───────────────────────────────────

ALTER TABLE public.supplier_publications ENABLE ROW LEVEL SECURITY;

-- supplier ve solo las suyas; operadores ven las de su región; superadmin ve todas
-- IMPORTANTE: supplier NUNCA ve información de otros proveedores (CLAUDE.md § 3)
CREATE POLICY "supplier_pub_select"
  ON public.supplier_publications FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator')
    OR (public.get_user_role() = 'operator' AND region_id = public.get_user_region_id())
  );

-- supplier publica sus propios productos; staff puede publicar en nombre de cualquiera
CREATE POLICY "supplier_pub_insert"
  ON public.supplier_publications FOR INSERT TO authenticated
  WITH CHECK (
    (supplier_id = auth.uid() AND public.get_user_role() = 'supplier')
    OR public.get_user_role() IN ('superadmin','operator')
  );

-- supplier actualiza sus propias publicaciones; staff actualiza cualquiera
CREATE POLICY "supplier_pub_update"
  ON public.supplier_publications FOR UPDATE TO authenticated
  USING (
    (supplier_id = auth.uid() AND public.get_user_role() = 'supplier')
    OR public.get_user_role() IN ('superadmin','operator')
  )
  WITH CHECK (
    (supplier_id = auth.uid() AND public.get_user_role() = 'supplier')
    OR public.get_user_role() IN ('superadmin','operator')
  );
