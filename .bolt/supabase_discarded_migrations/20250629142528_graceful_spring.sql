-- Fix storage buckets for file access
-- This migration ensures the storage buckets exist and have proper policies

-- First, let's check if buckets exist and create them if they don't
DO $$
BEGIN
  -- Create files bucket if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'files') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('files', 'files', false, 52428800, ARRAY[
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'text/plain', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]);
    RAISE NOTICE 'Created files bucket';
  ELSE
    -- Update existing bucket settings
    UPDATE storage.buckets 
    SET 
      public = false,
      file_size_limit = 52428800,
      allowed_mime_types = ARRAY[
        'application/pdf', 
        'image/jpeg', 
        'image/png', 
        'image/gif', 
        'text/plain', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    WHERE id = 'files';
    RAISE NOTICE 'Updated files bucket settings';
  END IF;

  -- Create avatars bucket if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    RAISE NOTICE 'Created avatars bucket';
  ELSE
    -- Update existing bucket settings
    UPDATE storage.buckets 
    SET 
      public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    WHERE id = 'avatars';
    RAISE NOTICE 'Updated avatars bucket settings';
  END IF;
END $$;

-- Drop ALL existing storage policies to start fresh
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on storage.objects
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

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

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify buckets were created and show final status
DO $$
DECLARE
    files_bucket_exists boolean;
    avatars_bucket_exists boolean;
    policy_count integer;
BEGIN
    -- Check if buckets exist
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'files') INTO files_bucket_exists;
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'avatars') INTO avatars_bucket_exists;
    
    -- Count policies
    SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' INTO policy_count;
    
    IF NOT files_bucket_exists THEN
        RAISE EXCEPTION 'Files bucket was not created successfully';
    END IF;
    
    IF NOT avatars_bucket_exists THEN
        RAISE EXCEPTION 'Avatars bucket was not created successfully';
    END IF;
    
    RAISE NOTICE 'Storage setup completed successfully:';
    RAISE NOTICE '- Files bucket: % (exists: %)', 'files', files_bucket_exists;
    RAISE NOTICE '- Avatars bucket: % (exists: %)', 'avatars', avatars_bucket_exists;
    RAISE NOTICE '- Storage policies created: %', policy_count;
END $$;