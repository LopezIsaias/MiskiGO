-- Bucket for customer claim photos (max 10 MB, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claim-photos',
  'claim-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated customers upload to their own folder
CREATE POLICY "Customer can upload claim photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read
CREATE POLICY "Public claim photos read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'claim-photos');
