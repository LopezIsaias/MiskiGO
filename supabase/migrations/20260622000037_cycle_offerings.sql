-- ================================================================
-- 037 — cycle_offerings (Fase 1: catálogo demanda-primero)
--
-- Desacopla el catálogo de que el proveedor publique. El operador/
-- superadmin "siembra" por ciclo qué productos se ofrecen, en qué
-- cantidad esperada y a qué precio de venta (CLAUDE.md §4: el
-- superadmin/operador define el precio final). El catálogo y el
-- checkout pasan a leer de aquí; supplier_publications queda como
-- fuente de SOURCING (Fase 2), no de catálogo.
--
-- Esta migración es ADITIVA: crea la tabla y su RLS. El cableado de
-- vista/checkout/UI ocurre en pasos posteriores de la Fase 1.
-- ================================================================

CREATE TABLE public.cycle_offerings (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_cycle_id uuid          NOT NULL REFERENCES public.dispatch_cycles(id) ON DELETE CASCADE,
  product_id        uuid          NOT NULL REFERENCES public.products(id),
  expected_quantity numeric(10,3) NOT NULL CHECK (expected_quantity > 0),
  sale_price        numeric(10,2) NOT NULL CHECK (sale_price > 0),
  status            text          NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active','inactive')),
  created_by        uuid          REFERENCES public.users(id),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (dispatch_cycle_id, product_id)
);

CREATE INDEX idx_cycle_offerings_cycle   ON public.cycle_offerings(dispatch_cycle_id);
CREATE INDEX idx_cycle_offerings_product ON public.cycle_offerings(product_id);
CREATE INDEX idx_cycle_offerings_active
  ON public.cycle_offerings(dispatch_cycle_id, product_id)
  WHERE status = 'active';

CREATE TRIGGER cycle_offerings_updated_at
  BEFORE UPDATE ON public.cycle_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────
-- El customer NO accede directo: lee el catálogo vía la vista
-- catalog_availability (security definer). Aquí solo gestiona el staff.
-- operator queda acotado a su región vía el ciclo.

ALTER TABLE public.cycle_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cycle_offerings_select"
  ON public.cycle_offerings FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('superadmin','region_operator')
    OR (
      public.get_user_role() = 'operator'
      AND EXISTS (
        SELECT 1 FROM public.dispatch_cycles dc
        WHERE dc.id = cycle_offerings.dispatch_cycle_id
          AND dc.region_id = public.get_user_region_id()
      )
    )
  );

CREATE POLICY "cycle_offerings_insert"
  ON public.cycle_offerings FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('superadmin','region_operator')
    OR (
      public.get_user_role() = 'operator'
      AND EXISTS (
        SELECT 1 FROM public.dispatch_cycles dc
        WHERE dc.id = cycle_offerings.dispatch_cycle_id
          AND dc.region_id = public.get_user_region_id()
      )
    )
  );

CREATE POLICY "cycle_offerings_update"
  ON public.cycle_offerings FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('superadmin','region_operator')
    OR (
      public.get_user_role() = 'operator'
      AND EXISTS (
        SELECT 1 FROM public.dispatch_cycles dc
        WHERE dc.id = cycle_offerings.dispatch_cycle_id
          AND dc.region_id = public.get_user_region_id()
      )
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('superadmin','region_operator')
    OR (
      public.get_user_role() = 'operator'
      AND EXISTS (
        SELECT 1 FROM public.dispatch_cycles dc
        WHERE dc.id = cycle_offerings.dispatch_cycle_id
          AND dc.region_id = public.get_user_region_id()
      )
    )
  );
