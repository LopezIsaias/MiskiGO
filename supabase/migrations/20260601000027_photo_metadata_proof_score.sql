-- ──────────────────────────────────────────────────────────────────────────────
-- Feature 3: photo_metadata jsonb on photo-bearing tables
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE reception_records    ADD COLUMN IF NOT EXISTS photo_metadata jsonb;
ALTER TABLE claims               ADD COLUMN IF NOT EXISTS photo_metadata jsonb;
ALTER TABLE payment_verifications ADD COLUMN IF NOT EXISTS photo_metadata jsonb;
ALTER TABLE wallet_transactions  ADD COLUMN IF NOT EXISTS photo_metadata jsonb;

-- ──────────────────────────────────────────────────────────────────────────────
-- Feature 4: resolution proof URL on claims
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE claims ADD COLUMN IF NOT EXISTS resolution_proof_url text;

-- Storage bucket for resolution proofs (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resolution-proofs', 'resolution-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "resolution_proofs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resolution-proofs');

CREATE POLICY "resolution_proofs_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resolution-proofs');

-- ──────────────────────────────────────────────────────────────────────────────
-- Feature 5: reliability_score on users + auto-update trigger
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS reliability_score numeric(5,2) DEFAULT 100;

CREATE OR REPLACE FUNCTION update_supplier_reliability_score()
RETURNS TRIGGER AS $$
DECLARE
  target_supplier uuid;
BEGIN
  target_supplier := COALESCE(NEW.supplier_id, OLD.supplier_id);

  UPDATE users SET reliability_score = (
    SELECT CASE
      WHEN COUNT(*) FILTER (WHERE status != 'pending') = 0 THEN 100
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE status IN ('confirmed', 'shipped'))::numeric
         / COUNT(*) FILTER (WHERE status != 'pending')::numeric) * 100,
        2
      )
    END
    FROM order_item_assignments
    WHERE supplier_id = target_supplier
  )
  WHERE id = target_supplier;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_supplier_reliability ON order_item_assignments;
CREATE TRIGGER trg_supplier_reliability
AFTER INSERT OR UPDATE OF status ON order_item_assignments
FOR EACH ROW EXECUTE FUNCTION update_supplier_reliability_score();
