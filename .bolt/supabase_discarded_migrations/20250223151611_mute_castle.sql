/*
  # Add file upload permissions for dozenten

  1. Changes
    - Add policies for dozenten to manage their own files
    - Update storage policies for file uploads
    - Add helper function to check folder ownership

  2. Security
    - Maintain folder-based access control
    - Allow dozenten to upload to their own folders
    - Preserve existing admin permissions
*/

-- Create a function to check if a user owns a folder
CREATE OR REPLACE FUNCTION public.owns_folder(folder_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM folders
    WHERE id = folder_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update storage policies for files bucket
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Users can upload files to their folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'files' AND
  (
    -- Allow if user owns the folder
    EXISTS (
      SELECT 1 FROM files
      JOIN folders ON folders.id = files.folder_id
      WHERE storage.objects.name LIKE folders.id || '/%'
      AND folders.user_id = auth.uid()
    )
    OR
    -- Or if user is admin
    (SELECT public.is_admin_v3())
  )
);

-- Update files table policies
DROP POLICY IF EXISTS "Users can upload files" ON files;
CREATE POLICY "Users can upload to own folders"
ON files
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user owns the folder
  folder_id IN (
    SELECT id FROM folders
    WHERE user_id = auth.uid()
  )
  OR
  -- Or if user is admin
  (SELECT public.is_admin_v3())
);

-- Ensure users can view their own files
DROP POLICY IF EXISTS "Users can view their own files" ON files;
CREATE POLICY "Users can view their own files"
ON files
FOR SELECT
TO authenticated
USING (
  -- Allow if user owns the folder
  folder_id IN (
    SELECT id FROM folders
    WHERE user_id = auth.uid()
  )
  OR
  -- Or if user is admin
  (SELECT public.is_admin_v3())
);

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON files;
CREATE POLICY "Users can delete their own files"
ON files
FOR DELETE
TO authenticated
USING (
  -- Allow if user uploaded the file
  uploaded_by = auth.uid()
  OR
  -- Or if user owns the folder
  folder_id IN (
    SELECT id FROM folders
    WHERE user_id = auth.uid()
  )
  OR
  -- Or if user is admin
  (SELECT public.is_admin_v3())
);

-- Update storage policies for viewing and deleting
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view files in their folders"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    -- Allow if user owns the folder
    EXISTS (
      SELECT 1 FROM files
      JOIN folders ON folders.id = files.folder_id
      WHERE storage.objects.name LIKE folders.id || '/%'
      AND folders.user_id = auth.uid()
    )
    OR
    -- Or if user is admin
    (SELECT public.is_admin_v3())
  )
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete files from their folders"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    -- Allow if user owns the folder
    EXISTS (
      SELECT 1 FROM files
      JOIN folders ON folders.id = files.folder_id
      WHERE storage.objects.name LIKE folders.id || '/%'
      AND folders.user_id = auth.uid()
    )
    OR
    -- Or if user is admin
    (SELECT public.is_admin_v3())
  )
);