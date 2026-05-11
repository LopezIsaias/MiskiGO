-- ================================================================
-- 010 — reception_records
-- Foto obligatoria. El repartidor registra lo recibido vs esperado.
-- rejected_quantity ≤ received_quantity no se valida en BD
-- (complejidad innecesaria para MVP; se valida en la app).
-- ================================================================

CREATE TABLE public.reception_records (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_person_id  uuid          NOT NULL REFERENCES public.users(id),
  dispatch_cycle_id   uuid          NOT NULL REFERENCES public.dispatch_cycles(id),
  supplier_id         uuid          NOT NULL REFERENCES public.users(id),
  product_id          uuid          NOT NULL REFERENCES public.products(id),
  expected_quantity   numeric(10,3) NOT NULL CHECK (expected_quantity > 0),
  received_quantity   numeric(10,3) NOT NULL CHECK (received_quantity >= 0),
  rejected_quantity   numeric(10,3) NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
  rejection_reason    text,
  photo_url           text          NOT NULL CHECK (photo_url <> ''),
  recorded_at         timestamptz   NOT NULL DEFAULT now(),
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_reception_delivery_person ON public.reception_records(delivery_person_id);
CREATE INDEX idx_reception_cycle_id        ON public.reception_records(dispatch_cycle_id);
CREATE INDEX idx_reception_supplier_id     ON public.reception_records(supplier_id);
CREATE INDEX idx_reception_product_id      ON public.reception_records(product_id);

-- ─── RLS: reception_records ───────────────────────────────────────

ALTER TABLE public.reception_records ENABLE ROW LEVEL SECURITY;

-- Repartidor ve sus propios registros; supplier ve los suyos; staff ve todos
CREATE POLICY "reception_records_select"
  ON public.reception_records FOR SELECT TO authenticated
  USING (
    delivery_person_id = auth.uid()
    OR supplier_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Solo el repartidor asignado registra la recepción
CREATE POLICY "reception_records_insert"
  ON public.reception_records FOR INSERT TO authenticated
  WITH CHECK (
    (delivery_person_id = auth.uid() AND public.get_user_role() = 'delivery')
    OR public.get_user_role() IN ('superadmin','operator')
  );

-- Correcciones solo por staff (queda en audit_log)
CREATE POLICY "reception_records_update"
  ON public.reception_records FOR UPDATE TO authenticated
  USING  (public.get_user_role() IN ('superadmin','operator'))
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));
