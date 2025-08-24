/*
  # Update default folders and add file management

  1. Changes
    - Update default folders trigger to create standard folders for all users
    - Add policies for file upload and download
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_default_folders_trigger ON profiles;
DROP FUNCTION IF EXISTS create_default_folders();

-- Create updated function for default folders
CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER AS $$
BEGIN
  -- Create standard folders for all users (both admin and dozent)
  INSERT INTO folders (name, user_id, is_system)
  VALUES
    ('Rechnungen', NEW.id, true),
    ('Tätigkeitsbericht', NEW.id, true),
    ('Aktive Teilnehmer', NEW.id, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER create_default_folders_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION create_default_folders();

-- Update policies for files
CREATE POLICY "Users can download their own files" ON files
  FOR SELECT TO authenticated
  USING (
    folder_id IN (
      SELECT id FROM folders WHERE user_id = auth.uid()
    ) OR auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Users can upload files to their folders" ON files
  FOR INSERT TO authenticated
  WITH CHECK (
    folder_id IN (
      SELECT id FROM folders WHERE user_id = auth.uid()
    ) OR auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Users can delete their own files" ON files
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid() OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );