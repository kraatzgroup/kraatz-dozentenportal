/*
  # Fix file access policies

  1. Changes
    - Drop existing policies that might be causing issues
    - Create more permissive policies for admins
    - Create proper policies for users to access their own files
    - Fix issues with file uploads and downloads

  2. Security
    - Maintain proper access control
    - Ensure admins can access all files
    - Ensure users can only access their own files
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their own files" ON files;
DROP POLICY IF EXISTS "Users can download their own files" ON files;
DROP POLICY IF EXISTS "files_access" ON files;
DROP POLICY IF EXISTS "Admins can view all files" ON files;
DROP POLICY IF EXISTS "Users can upload files to their folders" ON files;
DROP POLICY IF EXISTS "Users can update their own files" ON files;
DROP POLICY IF EXISTS "Users can delete their own files" ON files;

-- Create a more permissive policy for admins to view all files
CREATE POLICY "Admins can view all files" ON files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create policy for users to view their own files
CREATE POLICY "Users can view their own files" ON files
  FOR SELECT
  USING (
    folder_id IN (
      SELECT id FROM folders WHERE user_id = auth.uid()
    )
  );

-- Create policy for file uploads
CREATE POLICY "Users can upload files to their folders" ON files
  FOR INSERT
  WITH CHECK (
    folder_id IN (
      SELECT id FROM folders WHERE user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create policy for file updates
CREATE POLICY "Users can update their own files" ON files
  FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create policy for file deletion
CREATE POLICY "Users can delete their own files" ON files
  FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Ensure RLS is enabled
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Updated file access policies to fix visibility issues';
  RAISE NOTICE 'Admins can now view all files';
  RAISE NOTICE 'Users can view their own files';
END $$;