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

  -- Add table creation statements at the beginning
  backup_data := E'-- Database backup generated at ' || now() || E'\n\n' ||
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
    E'-- Insert data\n' ||
    COALESCE(backup_data, '-- No data to backup');

  RETURN backup_data;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_backup() TO authenticated;