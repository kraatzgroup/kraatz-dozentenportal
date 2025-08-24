-- Add profile_picture_url column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_picture_url text;

-- Drop existing storage policies to start fresh
DROP POLICY IF EXISTS "Users can upload files to their folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files in their folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from their folders" ON storage.objects;

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for avatar uploads
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (auth.uid()::text = substring(name from '^([^/]+)'))
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (auth.uid()::text = substring(name from '^([^/]+)'))
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (auth.uid()::text = substring(name from '^([^/]+)'))
);

-- Simplified storage policies for files
CREATE POLICY "Allow file uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
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