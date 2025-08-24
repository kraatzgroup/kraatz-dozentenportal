/*
  # Initial Schema Setup for Dozenten Portal

  1. Tables
    - profiles: User profiles with role management
    - folders: Document folders for users
    - files: File metadata storage
    - messages: Internal messaging system

  2. Security
    - RLS enabled on all tables
    - Admin role check function
    - Policies for all tables
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Create profiles table
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'dozent')),
  full_name text NOT NULL,
  profile_picture_url text,
  created_at timestamptz DEFAULT now()
);

-- Create folders table
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create files table
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('files', 'files', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

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

-- Function to create default folders for new users
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

-- Insert admin user
INSERT INTO profiles (id, role, full_name)
VALUES (
  'b91979ba-f5f6-44e5-b35a-217691f2f1ac',
  'admin',
  'Admin User'
) ON CONFLICT (id) DO NOTHING;