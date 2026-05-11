-- ================================================================
-- 008 — wallet_transactions & payment_verifications
-- wallet_transactions: inmutable (balance_before/after congelados)
-- UPDATE y DELETE prohibidos a nivel de BD mediante triggers.
-- ================================================================

-- ─── Table: wallet_transactions ───────────────────────────────────

CREATE TABLE public.wallet_transactions (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid          NOT NULL REFERENCES public.users(id),
  type               text          NOT NULL
                                   CHECK (type IN ('recharge','payment','refund','bonus','adjustment')),
  amount             numeric(10,2) NOT NULL,
  balance_before     numeric(10,2) NOT NULL,
  balance_after      numeric(10,2) NOT NULL,
  reference_order_id uuid          REFERENCES public.orders(id),
  proof_url          text,
  status             text          NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','approved','rejected')),
  approved_by        uuid          REFERENCES public.users(id),
  approved_at        timestamptz,
  notes              text,
  created_at         timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_tx_user_id   ON public.wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_order_id  ON public.wallet_transactions(reference_order_id)
  WHERE reference_order_id IS NOT NULL;
CREATE INDEX idx_wallet_tx_status    ON public.wallet_transactions(status);
CREATE INDEX idx_wallet_tx_type      ON public.wallet_transactions(type);
CREATE INDEX idx_wallet_tx_created   ON public.wallet_transactions(created_at DESC);

-- Inmutabilidad a nivel de BD (bypass RLS): protege balance_before y balance_after
CREATE TRIGGER wallet_transactions_no_update
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.raise_immutable_error();

CREATE TRIGGER wallet_transactions_no_delete
  BEFORE DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.raise_immutable_error();

-- ─── RLS: wallet_transactions ─────────────────────────────────────

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Usuario ve su propio historial de billetera; superadmin/region_operator ven todo
CREATE POLICY "wallet_tx_select"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator')
  );

-- Solo superadmin inserta transacciones (operador propone, superadmin aprueba via admin client)
CREATE POLICY "wallet_tx_insert"
  ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'superadmin');

-- Sin política UPDATE ni DELETE → prohibidos por RLS + reforzados por triggers

-- ─── Table: payment_verifications ────────────────────────────────

CREATE TABLE public.payment_verifications (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid          NOT NULL REFERENCES public.orders(id),
  method           text          NOT NULL CHECK (method IN ('yape','transfer')),
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  proof_url        text          NOT NULL,
  status           text          NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','approved','rejected')),
  submitted_at     timestamptz   NOT NULL DEFAULT now(),
  reviewed_by      uuid          REFERENCES public.users(id),
  reviewed_at      timestamptz,
  rejection_reason text
);

CREATE INDEX idx_payment_ver_order_id ON public.payment_verifications(order_id);
CREATE INDEX idx_payment_ver_status   ON public.payment_verifications(status);

-- ─── RLS: payment_verifications ───────────────────────────────────

ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;

-- Cliente ve los comprobantes de sus propios pedidos; staff ve todos
CREATE POLICY "payment_ver_select"
  ON public.payment_verifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_verifications.order_id
      AND (
        o.customer_id = auth.uid()
        OR public.get_user_role() IN ('superadmin','region_operator','operator')
      )
    )
  );

-- Cliente sube su comprobante; staff puede subir también
CREATE POLICY "payment_ver_insert"
  ON public.payment_verifications FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('superadmin','operator')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

-- Operador/superadmin revisan y aprueban o rechazan comprobantes
CREATE POLICY "payment_ver_update"
  ON public.payment_verifications FOR UPDATE TO authenticated
  USING  (public.get_user_role() IN ('superadmin','operator'))
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));
