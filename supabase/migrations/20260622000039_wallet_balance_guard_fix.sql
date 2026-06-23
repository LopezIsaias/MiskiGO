-- ================================================================
-- 039 — Fix del guard de balance en wallet_transactions
--
-- mig 028 bloqueaba CUALQUIER cambio de balance_before/after en UPDATE.
-- Pero la aprobación de un tx PENDIENTE (recarga/crédito/reembolso)
-- recalcula balance_before/after contra el saldo ACTUAL del cliente
-- (correcto: el saldo pudo cambiar desde la propuesta). Si cambió, el
-- trigger rechazaba la aprobación → reembolsos de Fase 3 y créditos
-- pendientes podían quedar imposibles de aprobar.
--
-- Nuevo invariante: los balances son inmutables SOLO una vez que el tx
-- está 'approved'. La transición pending → approved puede fijarlos.
-- ================================================================

CREATE OR REPLACE FUNCTION public.protect_wallet_balance_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Ledger congelado: una vez aprobado, balance_before/after no se tocan.
  IF OLD.status = 'approved' AND (
       NEW.balance_before IS DISTINCT FROM OLD.balance_before OR
       NEW.balance_after  IS DISTINCT FROM OLD.balance_after
     ) THEN
    RAISE EXCEPTION 'wallet_transactions: balance_before y balance_after son inmutables tras la aprobación';
  END IF;
  RETURN NEW;
END;
$$;
