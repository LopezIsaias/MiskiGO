-- ================================================================
-- 026 — Delivery confirmation code, delivery_attempts, in_storage
-- ================================================================

-- New columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_confirmation_code text,
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0;

-- Recreate CHECK constraint to include 'in_storage'
DO $$
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_payment','payment_submitted','confirmed','assigned',
    'in_transit','delivered','in_storage','completed','cancelled','failed'
  ));

-- Storage bucket for delivery incident photos (second failed attempt)
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-incidents', 'delivery-incidents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "delivery_incident_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-incidents'
    AND public.get_user_role() IN ('delivery','superadmin')
  );

CREATE POLICY "delivery_incident_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-incidents');

-- Allow suppliers to read their own order_item_assignments
CREATE POLICY "assignments_supplier_select"
  ON public.order_item_assignments FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Allow suppliers to read notifications sent to them
-- (Existing policy may already allow this; use IF NOT EXISTS pattern)
DO $$
BEGIN
  CREATE POLICY "notifications_supplier_select"
    ON public.notifications FOR SELECT TO authenticated
    USING (recipient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
