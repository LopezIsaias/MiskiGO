-- ================================================================
-- 029 — Comprobantes de pago (boleta / factura)
-- Cada pedido emite un comprobante al completarse la entrega.
-- MVP: recibo interno numerado, sin desglose de IGV ni envío a SUNAT.
-- El cliente elige boleta (DNI) o factura (RUC + razón social) en checkout.
-- ================================================================

-- ─── Datos de facturación capturados en checkout (sobre orders) ───
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS receipt_type     text
    CHECK (receipt_type IN ('boleta','factura')),
  ADD COLUMN IF NOT EXISTS receipt_document text,   -- DNI (boleta) o RUC (factura)
  ADD COLUMN IF NOT EXISTS receipt_name     text;   -- nombre (boleta) o razón social (factura)

-- ─── Contador correlativo por serie (atómico) ────────────────────
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  series      text PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

-- Devuelve el siguiente correlativo para una serie, incrementando atómicamente.
CREATE OR REPLACE FUNCTION public.next_receipt_correlative(p_series text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.receipt_counters (series, last_number)
  VALUES (p_series, 1)
  ON CONFLICT (series)
  DO UPDATE SET last_number = public.receipt_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;
$$;

-- ─── Tabla: receipts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipts (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid          NOT NULL UNIQUE REFERENCES public.orders(id),
  customer_id   uuid          NOT NULL REFERENCES public.users(id),
  type          text          NOT NULL CHECK (type IN ('boleta','factura')),
  series        text          NOT NULL,                 -- ej. 'B001' / 'F001'
  correlative   integer       NOT NULL,
  number        text          NOT NULL UNIQUE,          -- ej. 'B001-00000123'
  document      text          NOT NULL,                 -- DNI o RUC (snapshot)
  customer_name text          NOT NULL,                 -- nombre o razón social (snapshot)
  subtotal      numeric(10,2) NOT NULL,
  total         numeric(10,2) NOT NULL,
  issued_at     timestamptz   NOT NULL DEFAULT now(),
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_order_id    ON public.receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_customer_id ON public.receipts(customer_id);

-- Inmutabilidad: un comprobante emitido no se modifica ni elimina.
CREATE TRIGGER receipts_no_update
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.raise_immutable_error();

CREATE TRIGGER receipts_no_delete
  BEFORE DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.raise_immutable_error();

-- ─── RLS: receipts ────────────────────────────────────────────────
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- El cliente ve sus propios comprobantes; staff ve todos.
CREATE POLICY "receipts_select"
  ON public.receipts FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Inserción solo vía service role (emisión automática al entregar). Sin política INSERT
-- para authenticated → bloqueado por RLS; el admin client (service role) la omite.
