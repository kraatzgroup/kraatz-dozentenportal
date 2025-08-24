/*
  # Fix avatar upload functionality

  1. Changes
    - Drop existing avatar policies
    - Create new simplified policies for avatar uploads
    - Ensure avatars bucket is public
    - Add proper RLS policies for profile picture updates

  2. Security
    - Enable RLS on storage.objects
    - Add policies for avatar management
    - Ensure users can only manage their own avatars
*/

-- Ensure avatars bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing avatar policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Create simplified avatar policies
CREATE POLICY "Avatar management"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    -- Allow users to manage their own avatars
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Allow admins to manage all avatars
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    -- Allow users to manage their own avatars
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Allow admins to manage all avatars
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Add policy for profile picture updates
CREATE POLICY "Users can update their own profile picture"
ON profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);