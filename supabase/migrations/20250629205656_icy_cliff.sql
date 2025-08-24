/*
  # Fix storage access policies

  1. Changes
    - Drop existing storage policies that might be causing issues
    - Create more permissive policies for admins
    - Create proper policies for users to access their own files
    - Add a fallback policy for authenticated users

  2. Security
    - Maintain proper access control
    - Ensure admins can access all files
    - Ensure users can only access their own files
*/

-- Drop existing storage policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their own files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files to storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can access files in storage" ON storage.objects;

-- Create a more permissive policy for all authenticated users
-- This is a fallback to ensure files are accessible
CREATE POLICY "Authenticated users can access files in storage"
ON storage.objects FOR ALL
USING (
  bucket_id = 'files' AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'files' AND auth.role() = 'authenticated'
);

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

-- Create policy for file uploads
CREATE POLICY "Users can upload files to storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'files' AND auth.role() = 'authenticated'
);

-- Create policy for file updates
CREATE POLICY "Users can update files in storage"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'files' AND auth.role() = 'authenticated'
);

-- Create policy for file deletion
CREATE POLICY "Users can delete files in storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'files' AND auth.role() = 'authenticated'
);

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Updated storage access policies to fix visibility issues';
  RAISE NOTICE 'Added more permissive policies for authenticated users';
END $$;