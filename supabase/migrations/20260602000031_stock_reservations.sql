-- ================================================================
-- 031 — Reserva de stock con expiración (anti-sobreventa)
-- ================================================================
-- Al agregar un producto al carrito se crea una reserva temporal.
-- La disponibilidad mostrada en el catálogo y validada en checkout
-- descuenta las reservas activas y NO vencidas de otros clientes.
-- Las reservas vencidas se ignoran por filtro (expires_at > now());
-- no requieren limpieza para ser correctas.

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES public.users(id),
  product_id    uuid NOT NULL REFERENCES public.products(id),
  quantity      numeric(10,3) NOT NULL CHECK (quantity > 0),
  expires_at    timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','consumed','released','expired')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Una sola reserva activa por (cliente, producto)
CREATE UNIQUE INDEX IF NOT EXISTS stock_reservations_active_unique
  ON public.stock_reservations (customer_id, product_id)
  WHERE status = 'active';

-- Búsqueda de reservas activas por producto
CREATE INDEX IF NOT EXISTS stock_reservations_product_active
  ON public.stock_reservations (product_id, expires_at)
  WHERE status = 'active';

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

-- El cliente gestiona solo sus propias reservas
CREATE POLICY "reservations_customer_all"
  ON public.stock_reservations FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Staff puede ver todas (no modificar)
CREATE POLICY "reservations_staff_select"
  ON public.stock_reservations FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('superadmin','region_operator','operator'));
