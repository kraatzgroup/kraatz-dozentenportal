/*
  # Fix profile database issues and RLS policies

  1. Changes
    - Fix RLS policies that cause 406 errors
    - Clean up duplicate profiles and emails
    - Ensure all auth users have corresponding profiles
    - Create default folders for all users
    - Update trigger function for new users

  2. Security
    - Maintain proper RLS policies
    - Ensure data integrity
*/

-- First, let's check and fix any RLS policy issues that might cause 406 errors
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "Users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;

-- Create a more permissive read policy for profiles
CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Ensure the profiles_insert policy allows both self-insertion and admin insertion
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = id) OR 
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  );

-- Update the profiles_update policy
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = id) OR 
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  );

-- Step 1: Clean up duplicate emails by keeping the most recent profile for each email
DELETE FROM profiles p1
WHERE p1.ctid NOT IN (
    SELECT MAX(p2.ctid)
    FROM profiles p2
    WHERE p2.email = p1.email
    GROUP BY p2.email
);

-- Step 2: Remove profiles that don't have corresponding auth users
DELETE FROM profiles 
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id
);

-- Step 3: Handle the specific case where we might have email conflicts
-- Update any profiles that have conflicting emails to use a temporary email
UPDATE profiles 
SET email = 'temp-' || id || '@example.com'
WHERE email IN (
    SELECT email 
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = au.id AND p.email = au.email
    )
);

-- Step 4: Now safely create profiles for auth users that don't have them
DO $$
DECLARE
    user_record RECORD;
    profile_exists BOOLEAN;
    existing_profile_id UUID;
BEGIN
    -- Get all auth users that don't have profiles
    FOR user_record IN 
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN profiles p ON p.id = au.id
        WHERE p.id IS NULL
    LOOP
        -- Check if a profile with this email already exists
        SELECT EXISTS(SELECT 1 FROM profiles WHERE email = user_record.email) INTO profile_exists;
        
        IF profile_exists THEN
            -- Get the existing profile ID
            SELECT id INTO existing_profile_id FROM profiles WHERE email = user_record.email LIMIT 1;
            
            -- Update the existing profile to match this auth user
            UPDATE profiles 
            SET id = user_record.id,
                full_name = COALESCE(
                    user_record.raw_user_meta_data->>'full_name',
                    full_name,
                    split_part(user_record.email, '@', 1)
                ),
                role = CASE 
                    WHEN user_record.email = 'tools@kraatz-group.de' THEN 'admin'
                    WHEN role = 'admin' THEN 'admin'
                    ELSE 'dozent'
                END
            WHERE id = existing_profile_id;
        ELSE
            -- Create new profile
            INSERT INTO profiles (id, email, full_name, role)
            VALUES (
                user_record.id,
                user_record.email,
                COALESCE(
                    user_record.raw_user_meta_data->>'full_name',
                    split_part(user_record.email, '@', 1)
                ),
                CASE 
                    WHEN user_record.email = 'tools@kraatz-group.de' THEN 'admin'
                    ELSE 'dozent'
                END
            );
        END IF;
    END LOOP;
END $$;

-- Step 5: Ensure the admin user exists with correct data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'tools@kraatz-group.de') THEN
        INSERT INTO profiles (id, role, full_name, email)
        SELECT 
            au.id,
            'admin',
            'Admin User',
            au.email
        FROM auth.users au
        WHERE au.email = 'tools@kraatz-group.de'
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            email = EXCLUDED.email,
            full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
    END IF;
END $$;

-- Step 6: Create default folders for any users who don't have them
DO $$
DECLARE
    profile_record RECORD;
BEGIN
    FOR profile_record IN SELECT id FROM profiles LOOP
        -- Create standard folders if they don't exist
        INSERT INTO folders (name, user_id, is_system)
        SELECT 'Rechnungen', profile_record.id, true
        WHERE NOT EXISTS (
            SELECT 1 FROM folders 
            WHERE user_id = profile_record.id AND name = 'Rechnungen'
        );
        
        INSERT INTO folders (name, user_id, is_system)
        SELECT 'Tätigkeitsbericht', profile_record.id, true
        WHERE NOT EXISTS (
            SELECT 1 FROM folders 
            WHERE user_id = profile_record.id AND name = 'Tätigkeitsbericht'
        );
        
        INSERT INTO folders (name, user_id, is_system)
        SELECT 'Aktive Teilnehmer', profile_record.id, true
        WHERE NOT EXISTS (
            SELECT 1 FROM folders 
            WHERE user_id = profile_record.id AND name = 'Aktive Teilnehmer'
        );
    END LOOP;
END $$;

-- Step 7: Update the trigger function to handle conflicts better
CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER AS $$
DECLARE
    profile_exists BOOLEAN;
    existing_profile_id UUID;
BEGIN
    -- Check if profile already exists by email
    SELECT EXISTS(SELECT 1 FROM profiles WHERE email = NEW.email) INTO profile_exists;
    
    IF profile_exists THEN
        -- Get existing profile ID and update it
        SELECT id INTO existing_profile_id FROM profiles WHERE email = NEW.email LIMIT 1;
        
        UPDATE profiles 
        SET id = NEW.id,
            full_name = COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                full_name,
                split_part(NEW.email, '@', 1)
            ),
            role = CASE 
                WHEN NEW.email = 'tools@kraatz-group.de' THEN 'admin'
                WHEN role = 'admin' THEN 'admin'
                ELSE 'dozent'
            END
        WHERE id = existing_profile_id;
    ELSE
        -- Create new profile
        INSERT INTO profiles (id, email, full_name, role)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            CASE 
                WHEN NEW.email = 'tools@kraatz-group.de' THEN 'admin'
                ELSE 'dozent'
            END
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
            role = CASE 
                WHEN profiles.role = 'admin' THEN 'admin'
                ELSE EXCLUDED.role
            END;
    END IF;

    -- Create standard folders for the user
    INSERT INTO folders (name, user_id, is_system)
    VALUES
        ('Rechnungen', NEW.id, true),
        ('Tätigkeitsbericht', NEW.id, true),
        ('Aktive Teilnehmer', NEW.id, true)
    ON CONFLICT DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Recreate the trigger on auth.users
DROP TRIGGER IF EXISTS create_default_folders_trigger ON auth.users;
CREATE TRIGGER create_default_folders_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_folders();