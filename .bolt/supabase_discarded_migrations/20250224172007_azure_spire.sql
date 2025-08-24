-- Drop existing foreign key constraints
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_folder_id_fkey;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_uploaded_by_fkey;

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

-- Create indexes to improve join performance
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- Refresh the materialized view if it exists
REFRESH MATERIALIZED VIEW IF EXISTS admin_roles;