/*
  # Create missing default folders for existing users

  1. New Functions
    - `ensure_default_folders_for_user` - Creates default folders for a specific user
    - `create_missing_folders_for_all_users` - Creates missing folders for all existing users

  2. Default Folders Created
    - Rechnungen (for invoices)
    - Tätigkeitsbericht (for activity reports)  
    - Aktive Teilnehmer (for active participants)

  3. Execution
    - Creates folders for all existing users who don't have them
    - Updates the trigger function to be more robust
*/

-- Function to create default folders for a specific user
CREATE OR REPLACE FUNCTION ensure_default_folders_for_user(user_id uuid)
RETURNS void AS $$
DECLARE
    folder_names text[] := ARRAY['Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer'];
    folder_name text;
BEGIN
    FOREACH folder_name IN ARRAY folder_names
    LOOP
        -- Check if folder already exists
        IF NOT EXISTS (
            SELECT 1 FROM folders 
            WHERE folders.user_id = ensure_default_folders_for_user.user_id 
            AND folders.name = folder_name
        ) THEN
            -- Create the folder
            INSERT INTO folders (name, user_id, is_system)
            VALUES (folder_name, ensure_default_folders_for_user.user_id, true);
            
            RAISE NOTICE 'Created folder % for user %', folder_name, user_id;
        ELSE
            RAISE NOTICE 'Folder % already exists for user %', folder_name, user_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create missing folders for all existing users
CREATE OR REPLACE FUNCTION create_missing_folders_for_all_users()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    folder_count integer;
BEGIN
    -- Loop through all users
    FOR user_record IN 
        SELECT id, email, full_name, role FROM profiles 
        WHERE role IN ('admin', 'buchhaltung', 'verwaltung', 'vertrieb', 'dozent')
    LOOP
        -- Check how many folders this user has
        SELECT COUNT(*) INTO folder_count 
        FROM folders 
        WHERE user_id = user_record.id;
        
        RAISE NOTICE 'User % (%) has % folders', user_record.full_name, user_record.email, folder_count;
        
        -- Create default folders for this user
        PERFORM ensure_default_folders_for_user(user_record.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update the existing trigger function to be more robust
CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS trigger AS $$
BEGIN
    -- Create default folders for the new user
    PERFORM ensure_default_folders_for_user(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS create_default_folders_trigger ON profiles;
CREATE TRIGGER create_default_folders_trigger
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_folders();

-- Execute the function to create missing folders for all existing users
SELECT create_missing_folders_for_all_users();

-- Verify the results
DO $$
DECLARE
    user_record RECORD;
    folder_count integer;
BEGIN
    RAISE NOTICE '=== VERIFICATION RESULTS ===';
    
    FOR user_record IN 
        SELECT id, email, full_name, role FROM profiles 
        WHERE role IN ('admin', 'buchhaltung', 'verwaltung', 'vertrieb', 'dozent')
        ORDER BY full_name
    LOOP
        SELECT COUNT(*) INTO folder_count 
        FROM folders 
        WHERE user_id = user_record.id;
        
        RAISE NOTICE 'User: % (%) - Role: % - Folders: %', 
            user_record.full_name, 
            user_record.email, 
            user_record.role, 
            folder_count;
    END LOOP;
END;
$$;