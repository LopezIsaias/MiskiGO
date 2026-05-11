-- ================================================================
-- 007 — order_item_assignments
-- Los campos _frozen se congela al momento de asignación.
-- supplier_price_frozen y platform_margin_frozen son inmutables post-insert.
-- ================================================================

CREATE TABLE public.order_item_assignments (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id          uuid          NOT NULL REFERENCES public.order_items(id),
  publication_id         uuid          NOT NULL REFERENCES public.supplier_publications(id),
  supplier_id            uuid          NOT NULL REFERENCES public.users(id),
  assigned_quantity      numeric(10,3) NOT NULL CHECK (assigned_quantity > 0),
  supplier_price_frozen  numeric(10,2) NOT NULL CHECK (supplier_price_frozen > 0),
  platform_margin_frozen numeric(10,2) NOT NULL,
  status                 text          NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending','confirmed','shipped','failed')),
  confirmed_at           timestamptz,
  failure_reason         text,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_oia_order_item_id  ON public.order_item_assignments(order_item_id);
CREATE INDEX idx_oia_publication_id ON public.order_item_assignments(publication_id);
CREATE INDEX idx_oia_supplier_id    ON public.order_item_assignments(supplier_id);
CREATE INDEX idx_oia_status         ON public.order_item_assignments(status);

CREATE TRIGGER order_item_assignments_updated_at
  BEFORE UPDATE ON public.order_item_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS: order_item_assignments ──────────────────────────────────

ALTER TABLE public.order_item_assignments ENABLE ROW LEVEL SECURITY;

-- supplier ve solo sus asignaciones (NUNCA ve datos de otros proveedores)
CREATE POLICY "oia_select"
  ON public.order_item_assignments FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Solo staff genera asignaciones (manual o automático desde servidor)
CREATE POLICY "oia_insert"
  ON public.order_item_assignments FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));

-- supplier confirma recepción de su asignación; staff gestiona el resto
CREATE POLICY "oia_update"
  ON public.order_item_assignments FOR UPDATE TO authenticated
  USING (
    (supplier_id = auth.uid() AND public.get_user_role() = 'supplier')
    OR public.get_user_role() IN ('superadmin','operator')
  )
  WITH CHECK (
    (supplier_id = auth.uid() AND public.get_user_role() = 'supplier')
    OR public.get_user_role() IN ('superadmin','operator')
  );
