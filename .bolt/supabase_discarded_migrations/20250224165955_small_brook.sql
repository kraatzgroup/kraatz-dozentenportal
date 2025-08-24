/*
  # Initial Schema Setup for Dozenten Portal
  
  This migration creates the basic schema without foreign key constraints.
  Tables will be created first, then constraints will be added in a separate migration.

  1. Tables Created:
    - profiles: User profiles with role management
    - folders: Document folders for users
    - files: File metadata storage
    - messages: Internal messaging system

  2. Security:
    - RLS enabled on all tables
    - Basic policies for data access
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('admin', 'dozent')),
  full_name text NOT NULL,
  profile_picture_url text,
  created_at timestamptz DEFAULT now()
);

-- Create folders table
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create files table
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  folder_id uuid,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid,
  receiver_id uuid,
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

-- Insert admin user
INSERT INTO profiles (id, role, full_name)
VALUES (
  'b91979ba-f5f6-44e5-b35a-217691f2f1ac',
  'admin',
  'Admin User'
) ON CONFLICT (id) DO NOTHING;

-- Basic RLS policies
CREATE POLICY "profiles_read"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "folders_read"
ON folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "files_read"
ON files
FOR SELECT
TO authenticated
USING (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "messages_read"
ON messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid() OR
  receiver_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);