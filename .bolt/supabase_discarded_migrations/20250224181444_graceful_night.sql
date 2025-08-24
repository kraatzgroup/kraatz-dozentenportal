-- Create a function to generate database backup
CREATE OR REPLACE FUNCTION public.generate_backup()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  backup_data := E'-- Database backup generated at ' || now() || E'\n\n' ||
    -- Extensions
    E'-- Enable required extensions\n' ||
    E'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n' ||
    
    -- Admin function
    E'-- Create admin check function\n' ||
    E'CREATE OR REPLACE FUNCTION public.is_admin()\n' ||
    E'RETURNS boolean\n' ||
    E'LANGUAGE sql\n' ||
    E'SECURITY DEFINER\n' ||
    E'SET search_path = public\n' ||
    E'STABLE\n' ||
    E'AS $$\n' ||
    E'  SELECT EXISTS (\n' ||
    E'    SELECT 1\n' ||
    E'    FROM profiles\n' ||
    E'    WHERE id = auth.uid()\n' ||
    E'    AND role = ''admin''\n' ||
    E'    LIMIT 1\n' ||
    E'  );\n' ||
    E'$$;\n\n' ||

    -- Tables
    E'-- Create tables\n' ||
    E'CREATE TABLE IF NOT EXISTS profiles (\n' ||
    E'  id uuid PRIMARY KEY,\n' ||
    E'  role text NOT NULL CHECK (role IN (''admin'', ''dozent'')),\n' ||
    E'  full_name text NOT NULL,\n' ||
    E'  profile_picture_url text,\n' ||
    E'  created_at timestamptz DEFAULT now()\n' ||
    E');\n\n' ||
    
    E'CREATE TABLE IF NOT EXISTS folders (\n' ||
    E'  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n' ||
    E'  name text NOT NULL,\n' ||
    E'  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,\n' ||
    E'  is_system boolean DEFAULT false,\n' ||
    E'  created_at timestamptz DEFAULT now()\n' ||
    E');\n\n' ||
    
    E'CREATE TABLE IF NOT EXISTS files (\n' ||
    E'  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n' ||
    E'  name text NOT NULL,\n' ||
    E'  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,\n' ||
    E'  file_path text NOT NULL,\n' ||
    E'  uploaded_by uuid REFERENCES profiles(id) ON DELETE CASCADE,\n' ||
    E'  created_at timestamptz DEFAULT now()\n' ||
    E');\n\n' ||
    
    E'CREATE TABLE IF NOT EXISTS messages (\n' ||
    E'  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n' ||
    E'  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,\n' ||
    E'  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,\n' ||
    E'  content text NOT NULL,\n' ||
    E'  created_at timestamptz DEFAULT now(),\n' ||
    E'  read_at timestamptz\n' ||
    E');\n\n' ||

    -- Enable RLS
    E'-- Enable Row Level Security\n' ||
    E'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;\n' ||
    E'ALTER TABLE folders ENABLE ROW LEVEL SECURITY;\n' ||
    E'ALTER TABLE files ENABLE ROW LEVEL SECURITY;\n' ||
    E'ALTER TABLE messages ENABLE ROW LEVEL SECURITY;\n\n' ||

    -- Storage buckets
    E'-- Create storage buckets\n' ||
    E'INSERT INTO storage.buckets (id, name, public)\n' ||
    E'VALUES \n' ||
    E'  (''files'', ''files'', false),\n' ||
    E'  (''avatars'', ''avatars'', true)\n' ||
    E'ON CONFLICT (id) DO NOTHING;\n\n' ||

    -- RLS Policies
    E'-- Create RLS policies\n' ||
    E'CREATE POLICY "profiles_read" ON profiles FOR SELECT TO authenticated USING (true);\n\n' ||
    
    E'CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated\n' ||
    E'WITH CHECK (auth.uid() = id OR public.is_admin());\n\n' ||
    
    E'CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated\n' ||
    E'USING (auth.uid() = id OR (public.is_admin() AND id != auth.uid()));\n\n' ||
    
    E'CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated\n' ||
    E'USING (public.is_admin() AND id != auth.uid());\n\n' ||
    
    E'CREATE POLICY "folders_access" ON folders FOR ALL TO authenticated\n' ||
    E'USING (user_id = auth.uid() OR public.is_admin())\n' ||
    E'WITH CHECK (user_id = auth.uid() OR public.is_admin());\n\n' ||
    
    E'CREATE POLICY "files_access" ON files FOR ALL TO authenticated\n' ||
    E'USING (folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR public.is_admin())\n' ||
    E'WITH CHECK (folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR public.is_admin());\n\n' ||
    
    E'CREATE POLICY "messages_access" ON messages FOR ALL TO authenticated\n' ||
    E'USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin())\n' ||
    E'WITH CHECK (sender_id = auth.uid() OR public.is_admin());\n\n' ||
    
    E'CREATE POLICY "storage_access" ON storage.objects FOR ALL TO authenticated\n' ||
    E'USING (\n' ||
    E'  (bucket_id = ''files'' AND substring(name from ''^([^/]+)'') IN (SELECT id::text FROM folders WHERE user_id = auth.uid())) OR\n' ||
    E'  (bucket_id = ''avatars'' AND auth.uid()::text = (regexp_match(name, ''^([^/]+)''))[1]) OR\n' ||
    E'  public.is_admin()\n' ||
    E')\n' ||
    E'WITH CHECK (\n' ||
    E'  (bucket_id = ''files'' AND substring(name from ''^([^/]+)'') IN (SELECT id::text FROM folders WHERE user_id = auth.uid())) OR\n' ||
    E'  (bucket_id = ''avatars'' AND auth.uid()::text = (regexp_match(name, ''^([^/]+)''))[1]) OR\n' ||
    E'  public.is_admin()\n' ||
    E');\n\n' ||

    -- Default folders function
    E'-- Create function for default folders\n' ||
    E'CREATE OR REPLACE FUNCTION create_default_folders()\n' ||
    E'RETURNS TRIGGER AS $$\n' ||
    E'BEGIN\n' ||
    E'  INSERT INTO folders (name, user_id, is_system)\n' ||
    E'  VALUES\n' ||
    E'    (''Rechnungen'', NEW.id, true),\n' ||
    E'    (''Tätigkeitsbericht'', NEW.id, true),\n' ||
    E'    (''Aktive Teilnehmer'', NEW.id, true);\n' ||
    E'  RETURN NEW;\n' ||
    E'END;\n' ||
    E'$$ LANGUAGE plpgsql;\n\n' ||

    -- Create trigger
    E'-- Create trigger for default folders\n' ||
    E'CREATE TRIGGER create_default_folders_trigger\n' ||
    E'AFTER INSERT ON profiles\n' ||
    E'FOR EACH ROW\n' ||
    E'EXECUTE FUNCTION create_default_folders();\n\n' ||

    -- Insert data
    E'-- Insert data\n' ||
    COALESCE(backup_data, '-- No data to backup');

  RETURN backup_data;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_backup() TO authenticated;