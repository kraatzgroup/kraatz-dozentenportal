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
    SELECT 'INSERT INTO profiles (id, role, full_name, email, profile_picture_url, created_at) VALUES ' ||
           string_agg(
             '(' ||
             quote_literal(id) || ',' ||
             quote_literal(role) || ',' ||
             quote_literal(full_name) || ',' ||
             quote_literal(email) || ',' ||
             COALESCE(quote_literal(profile_picture_url), 'NULL') || ',' ||
             quote_literal(created_at::text) ||
             ')',
             E',\n'
           ) AS insert_sql
    FROM profiles
    UNION ALL
    -- Folders data
    SELECT 'INSERT INTO folders (id, name, user_id, is_system, created_at) VALUES ' ||
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
    FROM folders
    UNION ALL
    -- Files data
    SELECT 'INSERT INTO files (id, name, folder_id, file_path, uploaded_by, created_at) VALUES ' ||
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
    FROM files
    UNION ALL
    -- Messages data
    SELECT 'INSERT INTO messages (id, sender_id, receiver_id, content, created_at, read_at) VALUES ' ||
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
    FROM messages
  )
  SELECT string_agg(insert_sql, E';\n\n')
  INTO backup_data
  FROM table_data;

  RETURN COALESCE(backup_data, '-- No data to backup');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_backup() TO authenticated;