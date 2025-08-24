/*
  # Add downloaded_at timestamp to files table

  1. Changes
    - Add `downloaded_at` timestamp column to files table
    - This will track when admins download/view files
    - NULL value indicates file has not been downloaded yet
    - Useful for showing new file notifications in admin backend

  2. Security
    - Column is nullable to maintain backward compatibility
    - Only admins should be able to update this field
*/

-- Add downloaded_at column to files table
ALTER TABLE files 
ADD COLUMN downloaded_at timestamptz DEFAULT NULL;

-- Add index for efficient querying of undownloaded files
CREATE INDEX idx_files_downloaded_at ON files (downloaded_at);

-- Add index for querying new files (not downloaded yet)
CREATE INDEX idx_files_not_downloaded ON files (downloaded_at) WHERE downloaded_at IS NULL;

-- Create a function to mark file as downloaded
CREATE OR REPLACE FUNCTION mark_file_as_downloaded(file_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Only admins can mark files as downloaded
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can mark files as downloaded';
  END IF;
  
  -- Update the downloaded_at timestamp
  UPDATE files 
  SET downloaded_at = NOW() 
  WHERE id = file_id 
    AND downloaded_at IS NULL; -- Only update if not already downloaded
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get undownloaded files count for admin dashboard
CREATE OR REPLACE FUNCTION get_undownloaded_files_count()
RETURNS INTEGER AS $$
DECLARE
  current_user_role TEXT;
  file_count INTEGER;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Only admins can check undownloaded files
  IF current_user_role != 'admin' THEN
    RETURN 0;
  END IF;
  
  -- Count files that haven't been downloaded yet
  SELECT COUNT(*) INTO file_count
  FROM files 
  WHERE downloaded_at IS NULL;
  
  RETURN file_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for admin dashboard to show recent undownloaded files
CREATE OR REPLACE VIEW undownloaded_files_admin AS
SELECT 
  f.id,
  f.name,
  f.created_at,
  f.file_path,
  folder.name AS folder_name,
  uploader.full_name AS uploaded_by_name,
  uploader.email AS uploaded_by_email
FROM files f
JOIN folders folder ON f.folder_id = folder.id
JOIN profiles uploader ON f.uploaded_by = uploader.id
WHERE f.downloaded_at IS NULL
ORDER BY f.created_at DESC;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION mark_file_as_downloaded(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_undownloaded_files_count() TO authenticated;
GRANT SELECT ON undownloaded_files_admin TO authenticated;

-- Add RLS policy for the view (admins only)
CREATE POLICY "Admins can view undownloaded files" ON files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Update existing RLS policies to allow admins to update downloaded_at
CREATE POLICY "Admins can update downloaded_at" ON files
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Added downloaded_at timestamp column to files table:';
  RAISE NOTICE '- Column: downloaded_at (timestamptz, nullable)';
  RAISE NOTICE '- Function: mark_file_as_downloaded(file_id UUID)';
  RAISE NOTICE '- Function: get_undownloaded_files_count()';
  RAISE NOTICE '- View: undownloaded_files_admin (for admin dashboard)';
  RAISE NOTICE '- Indexes: idx_files_downloaded_at, idx_files_not_downloaded';
  RAISE NOTICE '- Use case: Track admin file downloads for notifications';
END $$;