-- Track when each in_app notification is read by its recipient
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
