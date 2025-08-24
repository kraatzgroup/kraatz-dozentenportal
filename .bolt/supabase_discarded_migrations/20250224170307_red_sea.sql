/*
  # Schema Fix for Dozenten Portal
  
  This migration fixes the schema by:
  1. Dropping storage policies first
  2. Dropping existing tables with CASCADE
  3. Creating tables without foreign key constraints
  4. Adding foreign key constraints after all tables exist
  5. Setting up proper RLS policies
*/

-- First drop storage policies
DROP POLICY IF EXISTS "storage_access" ON storage.objects;
DROP POLICY IF EXISTS "allow_manage_files" ON storage.objects;
DROP POLICY IF EXISTS "allow_manage_avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar management" ON storage.objects;
DROP POLICY IF EXISTS "File operations" ON storage.objects;
DROP POLICY IF EXISTS "storage_files_access" ON storage.objects;
DROP POLICY IF EXISTS "storage_access_policy" ON storage.objects;
DROP POLICY IF EXISTS "allow_storage_access" ON storage.objects;

-- Drop existing tables with CASCADE
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table first (no foreign keys yet)
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'dozent')),
  full_name text NOT NULL,
  profile_picture_url text,
  created_at timestamptz DEFAULT now()
);

-- Create folders table (no foreign keys yet)
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create files table (no foreign keys yet)
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  folder_id uuid,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Create messages table (no foreign keys yet)
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid,
  receiver_id uuid,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Now add foreign key constraints
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE folders
  ADD CONSTRAINT folders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id)
  ON DELETE CASCADE;

ALTER TABLE files
  ADD CONSTRAINT files_folder_id_fkey
  FOREIGN KEY (folder_id) REFERENCES folders(id)
  ON DELETE CASCADE,
  ADD CONSTRAINT files_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
  ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES profiles(id)
  ON DELETE CASCADE,
  ADD CONSTRAINT messages_receiver_id_fkey
  FOREIGN KEY (receiver_id) REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('files', 'files', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Insert admin user
INSERT INTO profiles (id, role, full_name)
VALUES (
  'b91979ba-f5f6-44e5-b35a-217691f2f1ac',
  'admin',
  'Admin User'
) ON CONFLICT (id) DO NOTHING;

-- Function to create default folders
CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER AS $$
BEGIN
  -- Create standard folders for all users
  INSERT INTO folders (name, user_id, is_system)
  VALUES
    ('Rechnungen', NEW.id, true),
    ('Tätigkeitsbericht', NEW.id, true),
    ('Aktive Teilnehmer', NEW.id, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new users
CREATE TRIGGER create_default_folders_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION create_default_folders();

-- Profile policies
CREATE POLICY "profiles_read"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id OR public.is_admin()
);

CREATE POLICY "profiles_update"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR (public.is_admin() AND id != auth.uid())
);

CREATE POLICY "profiles_delete"
ON profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin() AND id != auth.uid()
);

-- Folder policies
CREATE POLICY "folders_access"
ON folders
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin()
)
WITH CHECK (
  user_id = auth.uid() OR public.is_admin()
);

-- File policies
CREATE POLICY "files_access"
ON files
FOR ALL
TO authenticated
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin()
)
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin()
);

-- Message policies
CREATE POLICY "messages_access"
ON messages
FOR ALL
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  sender_id = auth.uid()
  OR public.is_admin()
);

-- Storage policies
CREATE POLICY "storage_access"
ON storage.objects
FOR ALL
TO authenticated
USING (
  (
    bucket_id = 'files'
    AND substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  )
  OR (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR public.is_admin()
)
WITH CHECK (
  (
    bucket_id = 'files'
    AND substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  )
  OR (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR public.is_admin()
);