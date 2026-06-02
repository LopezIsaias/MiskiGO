-- ================================================================
-- 030 — Solicitud de cancelación de pedido por el cliente
-- ================================================================
-- El cliente puede SOLICITAR cancelar un pedido mientras esté en
-- estado 'confirmed' y aún no 'assigned'. La aprobación y el reembolso
-- son MANUALES (operador/superadmin), conforme a CLAUDE.md §4.
-- Solo registra la intención; no cancela ni mueve dinero por sí solo.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason       text;
