-- ================================================================
-- 040 — order_item_substitutions (Sustitución de ítem fallido)
--
-- Cuando un order_item queda 'failed' (sin stock cubrible, TODO-O-NADA),
-- el operador puede PROPONER un producto alternativo en vez de solo
-- reembolsar (Fase 3). El cliente ACEPTA o RECHAZA desde la app
-- (consentimiento → respeta la inmutabilidad post-pago, §4).
--
-- Regla de precio (decisión de negocio): el sustituto NUNCA cuesta más
-- que el ítem original. charged_unit_price ≤ original_unit_price. Si es
-- menor, la diferencia (price_difference ≥ 0) se acredita a la billetera
-- como reembolso pendiente que aprueba el superadmin (§3/§8). Nunca se
-- cobra de más → no se reabre flujo de pago.
--
-- Al aceptar: se descuenta stock del sustituto (RPC atómica), se crea la
-- asignación confirmada, se repunta el order_item (product_id/precio/
-- subtotal congelados, status 'assigned') y se recalculan los totales del
-- pedido. Al rechazar/expirar: cae al reembolso de la Fase 3.
--
-- Migración ADITIVA: tabla + RLS. El cableado de API/UI es código.
-- ================================================================

CREATE TABLE public.order_item_substitutions (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id         uuid          NOT NULL REFERENCES public.order_items(id),
  order_id              uuid          NOT NULL REFERENCES public.orders(id),
  substitute_product_id uuid          NOT NULL REFERENCES public.products(id),
  publication_id        uuid          NOT NULL REFERENCES public.supplier_publications(id),
  quantity              numeric(10,3) NOT NULL CHECK (quantity > 0),
  original_unit_price   numeric(10,2) NOT NULL CHECK (original_unit_price > 0),
  charged_unit_price    numeric(10,2) NOT NULL CHECK (charged_unit_price > 0),
  price_difference      numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_difference >= 0),
  status                text          NOT NULL DEFAULT 'proposed'
                                      CHECK (status IN ('proposed','accepted','rejected','expired')),
  proposed_by           uuid          NOT NULL REFERENCES public.users(id),
  proposed_at           timestamptz   NOT NULL DEFAULT now(),
  responded_at          timestamptz,
  expires_at            timestamptz,
  notes                 text,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  -- El sustituto no puede costar más que el original (regla de negocio).
  CONSTRAINT substitution_price_cap CHECK (charged_unit_price <= original_unit_price)
);

-- Una sola propuesta activa ('proposed') por ítem a la vez.
CREATE UNIQUE INDEX idx_substitution_one_active
  ON public.order_item_substitutions(order_item_id)
  WHERE status = 'proposed';

CREATE INDEX idx_substitution_order ON public.order_item_substitutions(order_id);
CREATE INDEX idx_substitution_item  ON public.order_item_substitutions(order_item_id);

CREATE TRIGGER order_item_substitutions_updated_at
  BEFORE UPDATE ON public.order_item_substitutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────
-- El cliente ve las propuestas de SUS pedidos (para aceptar/rechazar
-- desde la app; la mutación ocurre server-side con service role). El
-- staff gestiona; operator acotado a su región vía orders.region_id.

ALTER TABLE public.order_item_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "substitutions_select"
  ON public.order_item_substitutions FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('superadmin','region_operator')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_item_substitutions.order_id
        AND (
          o.customer_id = auth.uid()
          OR (public.get_user_role() = 'operator' AND o.region_id = public.get_user_region_id())
        )
    )
  );

CREATE POLICY "substitutions_insert"
  ON public.order_item_substitutions FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('superadmin','region_operator')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_item_substitutions.order_id
        AND public.get_user_role() = 'operator'
        AND o.region_id = public.get_user_region_id()
    )
  );

CREATE POLICY "substitutions_update"
  ON public.order_item_substitutions FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('superadmin','region_operator')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_item_substitutions.order_id
        AND public.get_user_role() = 'operator'
        AND o.region_id = public.get_user_region_id()
    )
  );
