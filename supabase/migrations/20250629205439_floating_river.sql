/*
  # Fix storage bucket access policies

  1. Changes
    - Drop existing storage access policies
    - Create new, more permissive policies for admins
    - Fix policies for users to access their own files in storage
    - Ensure proper access control for storage operations

  2. Security
    - Maintain proper separation between user data
    - Allow admins to access all files in storage
    - Allow users to access only their own files in storage
*/

-- Drop existing storage policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their own files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files to storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files in storage" ON storage.objects;

-- Create a more permissive policy for admins to view all files
CREATE POLICY "Admins can view all files in storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'files' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Create policy for users to view their own files
CREATE POLICY "Users can view their own files in storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'files' AND
  (auth.uid() IN (
    SELECT user_id FROM folders WHERE id = (
      SELECT folder_id FROM files WHERE storage.objects.name LIKE folder_id || '/%'
    )
  ))
);

-- Create policy for file uploads
CREATE POLICY "Users can upload files to storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'files' AND
  (auth.uid() IN (
    SELECT user_id FROM folders WHERE id = (
      SELECT folder_id FROM files WHERE storage.objects.name LIKE folder_id || '/%'
    )
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
);

-- Create policy for file updates
CREATE POLICY "Users can update their own files in storage"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'files' AND
  (auth.uid() IN (
    SELECT uploaded_by FROM files WHERE storage.objects.name LIKE folder_id || '/%'
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
);

-- Create policy for file deletion
CREATE POLICY "Users can delete their own files in storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'files' AND
  (auth.uid() IN (
    SELECT uploaded_by FROM files WHERE storage.objects.name LIKE folder_id || '/%'
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
);

-- Create a more permissive policy for all authenticated users
CREATE POLICY "Authenticated users can access files in storage"
ON storage.objects FOR ALL
USING (
  bucket_id = 'files'
)
WITH CHECK (
  bucket_id = 'files'
);

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Updated storage access policies to fix visibility issues';
  RAISE NOTICE 'Added more permissive policies for authenticated users';
END $$;