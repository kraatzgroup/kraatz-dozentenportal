/*
  # Fix file upload permissions for dozenten

  1. Changes
    - Simplify storage policies for file uploads
    - Fix the order of permission checks
    - Add more explicit folder ownership checks

  2. Security
    - Maintain proper access control
    - Allow dozenten to upload to their folders
    - Keep admin permissions intact
*/

-- Drop existing storage policies to start fresh
DROP POLICY IF EXISTS "Users can upload files to their folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files in their folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from their folders" ON storage.objects;

-- Simplified storage policies
CREATE POLICY "Allow file uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'files' AND
  (
    -- Check folder ownership before the file is created
    substring(name from '^([^/]+)') IN (
      SELECT id::text
      FROM folders
      WHERE user_id = auth.uid()
    )
    OR
    (SELECT public.is_admin_v3())
  )
);

CREATE POLICY "Allow file downloads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    substring(name from '^([^/]+)') IN (
      SELECT id::text
      FROM folders
      WHERE user_id = auth.uid()
    )
    OR
    (SELECT public.is_admin_v3())
  )
);

CREATE POLICY "Allow file deletions"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    substring(name from '^([^/]+)') IN (
      SELECT id::text
      FROM folders
      WHERE user_id = auth.uid()
    )
    OR
    (SELECT public.is_admin_v3())
  )
);

-- Update files table policies
DROP POLICY IF EXISTS "Users can upload to own folders" ON files;
CREATE POLICY "Allow file records creation"
ON files
FOR INSERT
TO authenticated
WITH CHECK (
  folder_id IN (
    SELECT id
    FROM folders
    WHERE user_id = auth.uid()
  )
  OR
  (SELECT public.is_admin_v3())
);

-- Update view policy
DROP POLICY IF EXISTS "Users can view their own files" ON files;
CREATE POLICY "Allow viewing files"
ON files
FOR SELECT
TO authenticated
USING (
  folder_id IN (
    SELECT id
    FROM folders
    WHERE user_id = auth.uid()
  )
  OR
  (SELECT public.is_admin_v3())
);

-- Update delete policy
DROP POLICY IF EXISTS "Users can delete their own files" ON files;
CREATE POLICY "Allow file deletion"
ON files
FOR DELETE
TO authenticated
USING (
  folder_id IN (
    SELECT id
    FROM folders
    WHERE user_id = auth.uid()
  )
  OR
  uploaded_by = auth.uid()
  OR
  (SELECT public.is_admin_v3())
);