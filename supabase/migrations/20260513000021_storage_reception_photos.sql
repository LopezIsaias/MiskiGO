-- 021: Bucket de Supabase Storage para fotos de recepción de mercadería
-- Archivos almacenados en reception-photos/{user_id}/{timestamp}_{filename}
-- Tamaño máximo 10 MB (fotos de celular pueden ser pesadas)
-- HEIC/HEIF incluidos para compatibilidad con iPhone

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reception-photos',
  'reception-photos',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Solo usuarios autenticados pueden subir a su propia carpeta
CREATE POLICY "reception_photo_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reception-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública para que operadores puedan revisar las fotos
CREATE POLICY "reception_photo_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'reception-photos');
