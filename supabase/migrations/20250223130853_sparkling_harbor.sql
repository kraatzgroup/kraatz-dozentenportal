/*
  # Setup folder system

  1. Changes
    - Create default folders for all users
    - Set up folder policies for access control
    - Configure file storage and access policies
*/

-- Create default folders for existing users
INSERT INTO folders (name, user_id, is_system)
SELECT 'Rechnungen', id, true
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM folders 
  WHERE folders.user_id = profiles.id 
  AND folders.name = 'Rechnungen'
);

INSERT INTO folders (name, user_id, is_system)
SELECT 'Tätigkeitsbericht', id, true
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM folders 
  WHERE folders.user_id = profiles.id 
  AND folders.name = 'Tätigkeitsbericht'
);

INSERT INTO folders (name, user_id, is_system)
SELECT 'Aktive Teilnehmer', id, true
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM folders 
  WHERE folders.user_id = profiles.id 
  AND folders.name = 'Aktive Teilnehmer'
);

-- Create or replace function for creating default folders
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
DROP TRIGGER IF EXISTS create_default_folders_trigger ON profiles;
CREATE TRIGGER create_default_folders_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION create_default_folders();

-- Update folder policies
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all folders" ON folders;
CREATE POLICY "Admins can view all folders" ON folders
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can create folders" ON folders;
CREATE POLICY "Users can create folders" ON folders
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() AND NOT is_system OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() AND NOT is_system OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Update file policies
DROP POLICY IF EXISTS "Users can view their own files" ON files;
CREATE POLICY "Users can view their own files" ON files
  FOR SELECT TO authenticated
  USING (
    folder_id IN (
      SELECT id FROM folders WHERE user_id = auth.uid()
    ) OR auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can upload files" ON files;
CREATE POLICY "Users can upload files" ON files
  FOR INSERT TO authenticated
  WITH CHECK (
    folder_id IN (
      SELECT id FROM folders WHERE user_id = auth.uid()
    ) OR auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can delete their own files" ON files;
CREATE POLICY "Users can delete their own files" ON files
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid() OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );