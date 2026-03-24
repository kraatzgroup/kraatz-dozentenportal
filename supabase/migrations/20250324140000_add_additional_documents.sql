-- Add additional_documents JSONB column to elite_kleingruppe_releases
-- This stores uploaded documents that are shared with participants alongside regular materials
-- Each entry: {id, file_url, file_name, file_type, file_size, uploaded_at, uploaded_by}
ALTER TABLE elite_kleingruppe_releases
ADD COLUMN IF NOT EXISTS additional_documents jsonb DEFAULT '[]'::jsonb;
