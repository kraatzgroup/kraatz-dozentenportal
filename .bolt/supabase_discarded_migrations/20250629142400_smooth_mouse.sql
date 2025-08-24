-- Fix storage buckets for file access
-- This migration ensures the storage buckets exist and have proper policies

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('files', 'files', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing storage policies to recreate them
DROP POLICY IF EXISTS "storage_access" ON storage.objects;
DROP POLICY IF EXISTS "files_bucket_policy" ON storage.objects;
DROP POLICY IF EXISTS "avatars_bucket_policy" ON storage.objects;

-- Create comprehensive storage policies for files bucket
CREATE POLICY "files_bucket_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    -- Users can access files in their own folders
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR
    -- Admins can access all files
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "files_bucket_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'files' AND
  (
    -- Users can upload to their own folders
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR
    -- Admins can upload anywhere
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "files_bucket_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    -- Users can update files in their own folders
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR
    -- Admins can update all files
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "files_bucket_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    -- Users can delete files in their own folders
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR
    -- Admins can delete all files
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Create comprehensive storage policies for avatars bucket
CREATE POLICY "avatars_bucket_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    -- Users can view their own avatars
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Admins can view all avatars
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "avatars_bucket_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    -- Users can upload their own avatars
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Admins can upload any avatar
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "avatars_bucket_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    -- Users can update their own avatars
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Admins can update any avatar
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "avatars_bucket_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    -- Users can delete their own avatars
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    -- Admins can delete any avatar
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Verify buckets were created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'files') THEN
    RAISE EXCEPTION 'Files bucket was not created successfully';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    RAISE EXCEPTION 'Avatars bucket was not created successfully';
  END IF;
  
  RAISE NOTICE 'Storage buckets created successfully: files, avatars';
END $$;