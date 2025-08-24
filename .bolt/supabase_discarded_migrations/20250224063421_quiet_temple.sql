/*
  # Fix Avatar Upload Functionality

  1. Changes
    - Drop existing avatar policies
    - Create new simplified policies for avatar management
    - Add public access policy for avatar viewing
    - Fix permission checks for avatar operations

  2. Security
    - Maintain RLS for proper access control
    - Allow public access to avatar files
    - Ensure proper user and admin permissions
*/

-- Drop existing avatar policies
DROP POLICY IF EXISTS "Avatar management" ON storage.objects;

-- Create separate policies for different operations
CREATE POLICY "Allow public avatar access"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Allow avatar uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    -- User can upload their own avatar
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Admins can upload any avatar
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "Allow avatar updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    -- User can update their own avatar
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Admins can update any avatar
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "Allow avatar deletions"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    -- User can delete their own avatar
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Admins can delete any avatar
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Ensure avatars bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'avatars';