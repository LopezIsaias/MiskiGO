-- ================================================================
-- 011 — claims
-- La ventana de reclamo (2 horas post-entrega) se valida en la app
-- consultando orders.claim_window_expires_at.
-- Foto obligatoria. Solo superadmin puede reabrir el plazo.
-- ================================================================

CREATE TABLE public.claims (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid          NOT NULL REFERENCES public.orders(id),
  customer_id       uuid          NOT NULL REFERENCES public.users(id),
  product_id        uuid          NOT NULL REFERENCES public.products(id),
  claimed_quantity  numeric(10,3) NOT NULL CHECK (claimed_quantity > 0),
  reason            text          NOT NULL CHECK (reason <> ''),
  photo_url         text          NOT NULL CHECK (photo_url <> ''),
  status            text          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','partially_approved','rejected')),
  resolution_type   text          CHECK (resolution_type IN ('wallet_credit','external_refund','reprogrammed')),
  resolution_amount numeric(10,2) CHECK (resolution_amount >= 0),
  resolved_by       uuid          REFERENCES public.users(id),
  resolved_at       timestamptz,
  is_justified      boolean,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_claims_order_id    ON public.claims(order_id);
CREATE INDEX idx_claims_customer_id ON public.claims(customer_id);
CREATE INDEX idx_claims_product_id  ON public.claims(product_id);
CREATE INDEX idx_claims_status      ON public.claims(status);

-- ─── RLS: claims ──────────────────────────────────────────────────

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Cliente ve sus propios reclamos; staff ve todos
CREATE POLICY "claims_select"
  ON public.claims FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Cliente abre reclamo sobre sus propios pedidos
-- La validación de la ventana de tiempo se hace en la API route
CREATE POLICY "claims_insert"
  ON public.claims FOR INSERT TO authenticated
  WITH CHECK (
    (customer_id = auth.uid() AND public.get_user_role() = 'customer')
    OR public.get_user_role() IN ('superadmin','operator')
  );

-- Solo staff resuelve reclamos
CREATE POLICY "claims_update"
  ON public.claims FOR UPDATE TO authenticated
  USING  (public.get_user_role() IN ('superadmin','operator'))
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));
