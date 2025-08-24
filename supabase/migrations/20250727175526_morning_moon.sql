/*
  # Ensure default folders exist for all users

  1. Function Updates
    - Update create_default_folders function to handle all user types
    - Ensure proper folder creation for dozenten

  2. Data Fixes
    - Create missing default folders for existing users
    - Ensure all dozenten have required folders

  3. Security
    - Maintain existing RLS policies
*/

-- First, let's update the create_default_folders function to be more robust
CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default folders for all user types
  INSERT INTO folders (name, user_id, is_system) VALUES
    ('Rechnungen', NEW.id, true),
    ('Tätigkeitsbericht', NEW.id, true),
    ('Aktive Teilnehmer', NEW.id, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists and is properly set up
DROP TRIGGER IF EXISTS create_default_folders_trigger ON profiles;
CREATE TRIGGER create_default_folders_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_folders();

-- Create missing default folders for existing users who don't have them
DO $$
DECLARE
  user_record RECORD;
  folder_names TEXT[] := ARRAY['Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer'];
  folder_name TEXT;
BEGIN
  -- Loop through all users
  FOR user_record IN SELECT id, full_name FROM profiles LOOP
    -- Loop through required folder names
    FOREACH folder_name IN ARRAY folder_names LOOP
      -- Check if folder exists for this user
      IF NOT EXISTS (
        SELECT 1 FROM folders 
        WHERE user_id = user_record.id 
        AND name = folder_name
      ) THEN
        -- Create the missing folder
        INSERT INTO folders (name, user_id, is_system) 
        VALUES (folder_name, user_record.id, true);
        
        RAISE NOTICE 'Created folder % for user %', folder_name, user_record.full_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;