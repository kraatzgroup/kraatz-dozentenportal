-- Add soft delete columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add comment to explain the new columns
COMMENT ON COLUMN messages.is_deleted IS 'Soft delete flag - true if message was deleted by sender';
COMMENT ON COLUMN messages.deleted_at IS 'Timestamp when the message was deleted';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages(is_deleted);
