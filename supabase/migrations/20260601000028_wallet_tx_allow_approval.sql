-- ================================================================
-- 028 — Fix wallet_transactions trigger
-- El trigger original bloqueaba TODO update, incluyendo el cambio
-- de status (pending → approved/rejected) que hace el operador.
-- El trigger debe proteger solo balance_before y balance_after.
-- ================================================================

DROP TRIGGER IF EXISTS wallet_transactions_no_update ON public.wallet_transactions;

CREATE OR REPLACE FUNCTION public.protect_wallet_balance_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.balance_before IS DISTINCT FROM OLD.balance_before OR
     NEW.balance_after  IS DISTINCT FROM OLD.balance_after THEN
    RAISE EXCEPTION 'wallet_transactions: balance_before y balance_after son inmutables';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_transactions_protect_balance
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_balance_fields();
