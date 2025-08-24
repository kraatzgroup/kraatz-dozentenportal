/*
  # Fix Foreign Key Relationships and Joins

  1. Changes
    - Drop and recreate foreign key constraints with proper references
    - Create indexes for better join performance
    - Update RLS policies to use proper joins
*/

-- Drop existing foreign key constraints
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_folder_id_fkey;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_uploaded_by_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

-- Recreate foreign key constraints with proper references
ALTER TABLE files
ADD CONSTRAINT files_folder_id_fkey
FOREIGN KEY (folder_id)
REFERENCES folders(id)
ON DELETE CASCADE;

ALTER TABLE files
ADD CONSTRAINT files_uploaded_by_fkey
FOREIGN KEY (uploaded_by)
REFERENCES profiles(id)
ON DELETE CASCADE;

ALTER TABLE messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

ALTER TABLE messages
ADD CONSTRAINT messages_receiver_id_fkey
FOREIGN KEY (receiver_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- Create indexes to improve join performance
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);

-- Update RLS policies to use proper joins
DROP POLICY IF EXISTS "files_access" ON files;
CREATE POLICY "files_access"
ON files
FOR ALL
TO authenticated
USING (
  folder_id IN (
    SELECT f.id 
    FROM folders f
    WHERE f.user_id = auth.uid()
  )
  OR public.is_admin()
)
WITH CHECK (
  folder_id IN (
    SELECT f.id 
    FROM folders f
    WHERE f.user_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "messages_access" ON messages;
CREATE POLICY "messages_access"
ON messages
FOR ALL
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  sender_id = auth.uid()
  OR public.is_admin()
);