-- ──────────────────────────────────────────────────────────────────────────────
-- Foto de reclamo: fecha real de captura (EXIF) + verificación contra la entrega
-- Extraídas en el SERVIDOR (fuente de verdad, no se confía en el cliente).
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE claims ADD COLUMN IF NOT EXISTS photo_taken_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS photo_verification text
  CHECK (photo_verification IN ('valid','too_old','future','unknown'));
