-- 020: Bucket de Supabase Storage para comprobantes de pago
-- Archivos almacenados en payment-proofs/{user_id}/{timestamp}_{filename}
-- MVP: bucket público. Restringir acceso en producción.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Usuario autenticado sube solo a su propia carpeta ({user_id}/...)
CREATE POLICY "payment_proof_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública (bucket público, acceso por URL directa)
CREATE POLICY "payment_proof_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'payment-proofs');
