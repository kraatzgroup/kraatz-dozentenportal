-- Add file attachment columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Add comment to explain the new columns
COMMENT ON COLUMN messages.file_url IS 'URL to the file in Supabase Storage';
COMMENT ON COLUMN messages.file_name IS 'Original filename of the attachment';
COMMENT ON COLUMN messages.file_type IS 'MIME type of the file';
COMMENT ON COLUMN messages.file_size IS 'File size in bytes';
