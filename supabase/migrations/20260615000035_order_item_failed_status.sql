-- ================================================================
-- 035 — order_items.status: añadir 'failed'
-- ================================================================
-- BUG LATENTE: el CHECK original (migración 006) solo permitía
-- ('pending','assigned','delivered','rejected'), pero el código de
-- asignación de proveedores (runSupplierAssignment, fail-handler de
-- supplier/assignments, failOrderItemAllOrNothing) marca el ítem como
-- 'failed' cuando no hay cobertura. PostgREST rechazaba ese UPDATE por
-- el CHECK y el error se tragaba silenciosamente → el ítem quedaba en
-- 'pending' y el pedido nunca avanzaba a 'assigned' (se quedaba en
-- 'confirmed'). La lógica de avance de pedido ya contempla 'failed'
-- (assigned || failed || rejected), así que el valor faltaba en el
-- esquema, no en la lógica.
-- ================================================================

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_status_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_status_check
  CHECK (status IN ('pending','assigned','delivered','rejected','failed'));
