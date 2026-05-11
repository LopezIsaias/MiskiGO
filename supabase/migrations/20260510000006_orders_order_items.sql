-- ================================================================
-- 006 — orders & order_items
-- INMUTABILIDAD FINANCIERA: unit_price_frozen y subtotal_frozen
-- nunca se recalculan desde la tabla de productos.
-- Triggers: is_locked al aprobar pago, claim_window_expires_at al entregar.
-- NOTA: la política SELECT para delivery se añade en migración 009
--       tras crear delivery_routes y delivery_stops.
-- ================================================================

-- ─── Trigger: bloquear pedido cuando se aprueba el pago ──────────

CREATE OR REPLACE FUNCTION public.lock_order_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_approved_at IS NOT NULL AND OLD.payment_approved_at IS NULL THEN
    NEW.is_locked = true;
    NEW.locked_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Trigger: fijar ventana de reclamo al marcar como entregado ──

CREATE OR REPLACE FUNCTION public.set_claim_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.delivered_at IS NOT NULL AND OLD.delivered_at IS NULL THEN
    NEW.claim_window_expires_at = NEW.delivered_at + interval '2 hours';
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Table: orders ────────────────────────────────────────────────

CREATE TABLE public.orders (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             uuid          NOT NULL REFERENCES public.users(id),
  dispatch_cycle_id       uuid          NOT NULL REFERENCES public.dispatch_cycles(id),
  region_id               uuid          NOT NULL REFERENCES public.regions(id),
  grouped_delivery_id     uuid,
  status                  text          NOT NULL DEFAULT 'pending_payment'
                                        CHECK (status IN (
                                          'pending_payment','payment_submitted','confirmed',
                                          'assigned','in_transit','delivered','completed',
                                          'cancelled','failed'
                                        )),
  subtotal                numeric(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  delivery_fee            numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total_amount            numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_method          text          CHECK (payment_method IN ('yape','transfer','wallet')),
  payment_proof_url       text,
  payment_approved_at     timestamptz,
  payment_approved_by     uuid          REFERENCES public.users(id),
  is_locked               boolean       NOT NULL DEFAULT false,
  locked_at               timestamptz,
  delivery_address        text          NOT NULL CHECK (delivery_address <> ''),
  delivery_notes          text,
  customer_note           text,
  delivered_at            timestamptz,
  claim_window_expires_at timestamptz,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer_id       ON public.orders(customer_id);
CREATE INDEX idx_orders_dispatch_cycle_id ON public.orders(dispatch_cycle_id);
CREATE INDEX idx_orders_region_id         ON public.orders(region_id);
CREATE INDEX idx_orders_status            ON public.orders(status);
CREATE INDEX idx_orders_is_locked         ON public.orders(is_locked);
CREATE INDEX idx_orders_grouped_delivery  ON public.orders(grouped_delivery_id)
  WHERE grouped_delivery_id IS NOT NULL;

CREATE TRIGGER orders_lock_on_payment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.lock_order_on_payment();

CREATE TRIGGER orders_set_claim_window
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_claim_window();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS: orders ──────────────────────────────────────────────────

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- SELECT: cliente ve los suyos; operador ve su región; superadmin ve todos
-- delivery: política incompleta hasta migración 009 (no existen delivery_stops aún)
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator')
    OR (public.get_user_role() = 'operator' AND region_id = public.get_user_region_id())
  );

-- INSERT: cliente crea sus pedidos; staff puede crear en nombre del cliente
CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    (customer_id = auth.uid() AND public.get_user_role() = 'customer')
    OR public.get_user_role() IN ('superadmin','operator')
  );

-- UPDATE: cliente solo puede editar antes de que esté bloqueado
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    (customer_id = auth.uid() AND public.get_user_role() = 'customer' AND is_locked = false)
    OR public.get_user_role() IN ('superadmin','operator')
  )
  WITH CHECK (
    (customer_id = auth.uid() AND public.get_user_role() = 'customer' AND is_locked = false)
    OR public.get_user_role() IN ('superadmin','operator')
  );

-- ─── Table: order_items ───────────────────────────────────────────

CREATE TABLE public.order_items (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id        uuid          NOT NULL REFERENCES public.products(id),
  quantity          numeric(10,3) NOT NULL CHECK (quantity > 0),
  unit_price_frozen numeric(10,2) NOT NULL CHECK (unit_price_frozen > 0),
  subtotal_frozen   numeric(10,2) NOT NULL CHECK (subtotal_frozen >= 0),
  status            text          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','assigned','delivered','rejected')),
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id   ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_order_items_status     ON public.order_items(status);

-- ─── RLS: order_items ─────────────────────────────────────────────

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- SELECT: misma lógica que orders, heredada vía join con order_id
-- delivery: política actualizada en migración 009
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (
        o.customer_id = auth.uid()
        OR public.get_user_role() IN ('superadmin','region_operator')
        OR (public.get_user_role() = 'operator' AND o.region_id = public.get_user_region_id())
      )
    )
  );

-- INSERT: cliente agrega ítems a sus propios pedidos no bloqueados
CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('superadmin','operator')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND o.customer_id = auth.uid()
      AND o.is_locked = false
    )
  );

-- UPDATE: solo staff actualiza ítems (cambios de estado post-confirmación)
CREATE POLICY "order_items_update"
  ON public.order_items FOR UPDATE TO authenticated
  USING  (public.get_user_role() IN ('superadmin','operator'))
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));
