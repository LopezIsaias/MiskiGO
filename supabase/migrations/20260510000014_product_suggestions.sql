-- ================================================================
-- 014 — product_suggestions
-- Clientes sugieren productos; operadores/superadmin revisan.
-- ================================================================

CREATE TABLE public.product_suggestions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid        NOT NULL REFERENCES public.users(id),
  product_name   text        NOT NULL CHECK (product_name <> ''),
  description    text,
  use_case       text,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','reviewing','added','rejected')),
  reviewed_by    uuid        REFERENCES public.users(id),
  response_notes text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_suggestions_customer ON public.product_suggestions(customer_id);
CREATE INDEX idx_product_suggestions_status   ON public.product_suggestions(status);

CREATE TRIGGER product_suggestions_updated_at
  BEFORE UPDATE ON public.product_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS: product_suggestions ─────────────────────────────────────

ALTER TABLE public.product_suggestions ENABLE ROW LEVEL SECURITY;

-- Cliente ve sus propias sugerencias; staff ve todas
CREATE POLICY "product_suggestions_select"
  ON public.product_suggestions FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Solo clientes registrados sugieren productos
CREATE POLICY "product_suggestions_insert"
  ON public.product_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    (customer_id = auth.uid() AND public.get_user_role() = 'customer')
    OR public.get_user_role() = 'superadmin'
  );

-- Staff revisa y responde sugerencias
CREATE POLICY "product_suggestions_update"
  ON public.product_suggestions FOR UPDATE TO authenticated
  USING  (public.get_user_role() IN ('superadmin','operator'))
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));
