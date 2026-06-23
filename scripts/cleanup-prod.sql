-- ============================================================================
-- cleanup-prod.sql — Reinicio de datos OPERATIVOS (Miski GO)
--
-- ⚠️  DESTRUCTIVO E IRREVERSIBLE. Hacer BACKUP antes (ver instrucciones abajo).
--
-- CONSERVA: users, products, product_categories, regions, system_params.
-- BORRA:    todo lo operativo (pedidos, asignaciones, publicaciones, ciclos,
--           ofertas, reservas, billetera, pagos, entregas, recepciones,
--           reclamos, reputación, notificaciones, sugerencias, recibos) y el
--           audit_log.
-- RESET:    users.wallet_balance = 0 ; users.reputation_score = 100.
--
-- Decisiones tomadas con el usuario (2026-06-22): audit_log se borra; saldo a 0;
-- reputación a 100.
--
-- Ejecutar como rol con privilegios (postgres / service_role): el guard de
-- columnas de users (mig 036) solo permite resetear wallet_balance/reputation
-- a service_role/postgres. TRUNCATE evita el trigger BEFORE DELETE de audit_log.
-- ============================================================================

BEGIN;

TRUNCATE TABLE
  public.order_item_assignments,
  public.order_items,
  public.orders,
  public.supplier_publications,
  public.cycle_offerings,
  public.dispatch_cycles,
  public.stock_reservations,
  public.wallet_transactions,
  public.payment_verifications,
  public.delivery_stops,
  public.delivery_routes,
  public.reception_records,
  public.claims,
  public.reputation_events,
  public.notifications,
  public.product_suggestions,
  public.receipts,
  public.receipt_counters,
  public.audit_log
RESTART IDENTITY CASCADE;

-- Reset de campos derivados en users (consistencia con ledger/eventos vacíos).
UPDATE public.users SET wallet_balance   = 0   WHERE wallet_balance   <> 0;
UPDATE public.users SET reputation_score = 100 WHERE reputation_score <> 100;

COMMIT;

-- Verificación rápida (opcional, correr aparte):
--   SELECT count(*) FROM public.orders;                 -- 0
--   SELECT count(*) FROM public.audit_log;              -- 0
--   SELECT count(*) FROM public.users;                  -- intacto
--   SELECT count(*) FROM public.products;               -- intacto
--   SELECT count(*) FROM public.wallet_transactions;    -- 0
--   SELECT count(*) FILTER (WHERE wallet_balance <> 0) FROM public.users;     -- 0
