INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wallet-proofs',
  'wallet-proofs',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own wallet proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'wallet-proofs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public read wallet proofs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'wallet-proofs');
