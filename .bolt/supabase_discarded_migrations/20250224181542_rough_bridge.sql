-- Drop existing backup function
DROP FUNCTION IF EXISTS public.generate_backup();

-- Create a function to generate database backup
CREATE OR REPLACE FUNCTION public.generate_backup()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  backup_data text;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can generate backups';
  END IF;

  -- Generate backup data
  WITH table_data AS (
    -- Profiles data
    SELECT 
      CASE 
        WHEN COUNT(*) > 0 THEN
          'INSERT INTO profiles (id, role, full_name, profile_picture_url, created_at) VALUES ' ||
          string_agg(
            '(' ||
            quote_literal(id) || ',' ||
            quote_literal(role) || ',' ||
            quote_literal(full_name) || ',' ||
            COALESCE(quote_literal(profile_picture_url), 'NULL') || ',' ||
            quote_literal(created_at::text) ||
            ')',
            E',\n'
          )
        ELSE NULL
      END AS insert_sql
    FROM profiles
    UNION ALL
    -- Folders data
    SELECT 
      CASE 
        WHEN COUNT(*) > 0 THEN
          'INSERT INTO folders (id, name, user_id, is_system, created_at) VALUES ' ||
          string_agg(
            '(' ||
            quote_literal(id) || ',' ||
            quote_literal(name) || ',' ||
            quote_literal(user_id) || ',' ||
            is_system::text || ',' ||
            quote_literal(created_at::text) ||
            ')',
            E',\n'
          )
        ELSE NULL
      END
    FROM folders
    UNION ALL
    -- Files data
    SELECT 
      CASE 
        WHEN COUNT(*) > 0 THEN
          'INSERT INTO files (id, name, folder_id, file_path, uploaded_by, created_at) VALUES ' ||
          string_agg(
            '(' ||
            quote_literal(id) || ',' ||
            quote_literal(name) || ',' ||
            quote_literal(folder_id) || ',' ||
            quote_literal(file_path) || ',' ||
            quote_literal(uploaded_by) || ',' ||
            quote_literal(created_at::text) ||
            ')',
            E',\n'
          )
        ELSE NULL
      END
    FROM files
    UNION ALL
    -- Messages data
    SELECT 
      CASE 
        WHEN COUNT(*) > 0 THEN
          'INSERT INTO messages (id, sender_id, receiver_id, content, created_at, read_at) VALUES ' ||
          string_agg(
            '(' ||
            quote_literal(id) || ',' ||
            quote_literal(sender_id) || ',' ||
            quote_literal(receiver_id) || ',' ||
            quote_literal(content) || ',' ||
            quote_literal(created_at::text) || ',' ||
            COALESCE(quote_literal(read_at::text), 'NULL') ||
            ')',
            E',\n'
          )
        ELSE NULL
      END
    FROM messages
  )
  SELECT string_agg(
    CASE 
      WHEN insert_sql IS NOT NULL THEN insert_sql || ';'
      ELSE NULL 
    END,
    E'\n\n'
  )
  INTO backup_data
  FROM table_data
  WHERE insert_sql IS NOT NULL;

  -- Add schema setup at the beginning
  backup_data := format(
    $schema$-- Database backup generated at %s

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $inner$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$inner$;

-- Create tables
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'dozent')),
  full_name text NOT NULL,
  profile_picture_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Enable Row Level Security
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

-- Create RLS policies
CREATE POLICY "profiles_read" ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR (public.is_admin() AND id != auth.uid()));

CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated
USING (public.is_admin() AND id != auth.uid());

CREATE POLICY "folders_access" ON folders FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "files_access" ON files FOR ALL TO authenticated
USING (folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR public.is_admin())
WITH CHECK (folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR public.is_admin());

CREATE POLICY "messages_access" ON messages FOR ALL TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin())
WITH CHECK (sender_id = auth.uid() OR public.is_admin());

CREATE POLICY "storage_access" ON storage.objects FOR ALL TO authenticated
USING (
  (bucket_id = 'files' AND substring(name from '^([^/]+)') IN (SELECT id::text FROM folders WHERE user_id = auth.uid())) OR
  (bucket_id = 'avatars' AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]) OR
  public.is_admin()
)
WITH CHECK (
  (bucket_id = 'files' AND substring(name from '^([^/]+)') IN (SELECT id::text FROM folders WHERE user_id = auth.uid())) OR
  (bucket_id = 'avatars' AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]) OR
  public.is_admin()
);

-- Create function for default folders
CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER AS $trigger$
BEGIN
  INSERT INTO folders (name, user_id, is_system)
  VALUES
    ('Rechnungen', NEW.id, true),
    ('Tätigkeitsbericht', NEW.id, true),
    ('Aktive Teilnehmer', NEW.id, true);
  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

-- Create trigger for default folders
CREATE TRIGGER create_default_folders_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION create_default_folders();

-- Insert data
%s$schema$,
    now(),
    COALESCE(backup_data, '-- No data to backup')
  );

  RETURN backup_data;
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_backup() TO authenticated;