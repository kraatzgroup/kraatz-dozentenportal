-- Add email column to profiles table and link specific user
-- This migration adds the email column and handles the specific user linking case

-- First, add the email column if it doesn't exist
DO $$
BEGIN
    -- Check if email column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'email'
        AND table_schema = 'public'
    ) THEN
        -- Add email column
        ALTER TABLE profiles ADD COLUMN email text;
        RAISE NOTICE 'Added email column to profiles table';
    ELSE
        RAISE NOTICE 'Email column already exists in profiles table';
    END IF;
END $$;

-- Sync emails from auth.users to profiles for existing users
DO $$
DECLARE
    user_record RECORD;
    sync_count INTEGER := 0;
BEGIN
    -- Update profiles with emails from auth.users
    FOR user_record IN 
        SELECT 
            au.id, 
            au.email as auth_email, 
            p.email as profile_email,
            p.full_name
        FROM auth.users au
        JOIN profiles p ON au.id = p.id
        WHERE p.email IS NULL OR p.email = '' OR p.email IS DISTINCT FROM au.email
    LOOP
        UPDATE profiles 
        SET email = user_record.auth_email 
        WHERE id = user_record.id;
        
        sync_count := sync_count + 1;
        RAISE NOTICE 'Synced email for user %: % -> %', 
            user_record.full_name, user_record.profile_email, user_record.auth_email;
    END LOOP;
    
    RAISE NOTICE 'Email synchronization completed. Updated % profiles', sync_count;
END $$;

-- Handle the specific user linking case
-- Link auth user bfa8ed1e-edb4-4419-b917-94626982961f (Charlene Nowak) 
-- to profile 4b4ac71f-59d0-4f9d-8d1d-b7b8755aba66
DO $$
DECLARE
    auth_user_id uuid := 'bfa8ed1e-edb4-4419-b917-94626982961f';
    old_profile_id uuid := '4b4ac71f-59d0-4f9d-8d1d-b7b8755aba66';
    user_email text := 'charlenenowak@gmx.de';
    user_name text := 'Charlene Nowak';
    auth_user_exists boolean := false;
    old_profile_exists boolean := false;
    new_profile_exists boolean := false;
BEGIN
    -- Check if the auth user exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = auth_user_id) INTO auth_user_exists;
    
    -- Check if the old profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = old_profile_id) INTO old_profile_exists;
    
    -- Check if a profile with the auth user ID already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth_user_id) INTO new_profile_exists;
    
    RAISE NOTICE 'Auth user % exists: %', auth_user_id, auth_user_exists;
    RAISE NOTICE 'Old profile % exists: %', old_profile_id, old_profile_exists;
    RAISE NOTICE 'Profile with auth user ID exists: %', new_profile_exists;
    
    IF auth_user_exists THEN
        IF old_profile_exists AND NOT new_profile_exists THEN
            -- Update the old profile to use the auth user's ID
            -- First, we need to handle any foreign key constraints
            
            -- Update folders to point to the new user ID
            UPDATE folders 
            SET user_id = auth_user_id 
            WHERE user_id = old_profile_id;
            
            -- Update files uploaded_by to point to the new user ID
            UPDATE files 
            SET uploaded_by = auth_user_id 
            WHERE uploaded_by = old_profile_id;
            
            -- Update messages sender_id to point to the new user ID
            UPDATE messages 
            SET sender_id = auth_user_id 
            WHERE sender_id = old_profile_id;
            
            -- Update messages receiver_id to point to the new user ID
            UPDATE messages 
            SET receiver_id = auth_user_id 
            WHERE receiver_id = old_profile_id;
            
            -- Now update the profile ID
            UPDATE profiles 
            SET 
                id = auth_user_id,
                email = user_email,
                full_name = user_name
            WHERE id = old_profile_id;
            
            RAISE NOTICE 'Successfully linked profile % to auth user % with email %', 
                old_profile_id, auth_user_id, user_email;
                
        ELSIF new_profile_exists THEN
            -- Profile with auth user ID already exists, just update the email and name
            UPDATE profiles 
            SET 
                email = user_email,
                full_name = user_name
            WHERE id = auth_user_id;
            
            RAISE NOTICE 'Updated existing profile % with email %', auth_user_id, user_email;
            
            -- If old profile still exists, we might need to merge or delete it
            IF old_profile_exists THEN
                RAISE WARNING 'Old profile % still exists. Manual cleanup may be required.', old_profile_id;
            END IF;
            
        ELSE
            -- Auth user exists but no profiles, create new profile
            INSERT INTO profiles (id, email, full_name, role, created_at)
            VALUES (auth_user_id, user_email, user_name, 'dozent', now())
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name;
                
            RAISE NOTICE 'Created new profile for auth user % with email %', auth_user_id, user_email;
        END IF;
    ELSE
        RAISE WARNING 'Auth user % does not exist. Cannot link profile.', auth_user_id;
    END IF;
END $$;

-- Add constraints to the email column
DO $$
BEGIN
    -- Set email column to NOT NULL (after ensuring all emails are populated)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'email'
        AND is_nullable = 'YES'
        AND table_schema = 'public'
    ) THEN
        -- First, ensure no NULL emails exist
        UPDATE profiles 
        SET email = COALESCE(
            (SELECT email FROM auth.users WHERE auth.users.id = profiles.id),
            'unknown@example.com'
        )
        WHERE email IS NULL OR email = '';
        
        -- Then set NOT NULL constraint
        ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;
        RAISE NOTICE 'Set email column to NOT NULL';
    END IF;
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_email_unique' 
        AND table_name = 'profiles'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
        RAISE NOTICE 'Added unique constraint to email column';
    END IF;
    
    -- Add email validation constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_email_check' 
        AND table_name = 'profiles'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_check CHECK (
            email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
        );
        RAISE NOTICE 'Added email validation constraint';
    END IF;
END $$;

-- Ensure foreign key constraint exists between profiles and auth.users
DO $$
BEGIN
    -- Check if the foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' 
        AND table_name = 'profiles'
        AND table_schema = 'public'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE profiles 
        ADD CONSTRAINT profiles_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint between profiles and auth.users';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- Final verification
DO $$
DECLARE
    charlene_profile RECORD;
    total_profiles INTEGER;
    total_auth_users INTEGER;
    profiles_with_email INTEGER;
BEGIN
    -- Check Charlene's specific profile
    SELECT * FROM profiles 
    WHERE email = 'charlenenowak@gmx.de' 
    INTO charlene_profile;
    
    IF FOUND THEN
        RAISE NOTICE 'Charlene Nowak profile found:';
        RAISE NOTICE '- ID: %', charlene_profile.id;
        RAISE NOTICE '- Email: %', charlene_profile.email;
        RAISE NOTICE '- Full Name: %', charlene_profile.full_name;
        RAISE NOTICE '- Role: %', charlene_profile.role;
    ELSE
        RAISE WARNING 'Charlene Nowak profile not found!';
    END IF;
    
    -- Overall verification
    SELECT COUNT(*) FROM profiles INTO total_profiles;
    SELECT COUNT(*) FROM auth.users INTO total_auth_users;
    SELECT COUNT(*) FROM profiles WHERE email IS NOT NULL AND email != '' INTO profiles_with_email;
    
    RAISE NOTICE 'Final verification:';
    RAISE NOTICE '- Total profiles: %', total_profiles;
    RAISE NOTICE '- Total auth users: %', total_auth_users;
    RAISE NOTICE '- Profiles with email: %', profiles_with_email;
    
    IF profiles_with_email = total_profiles THEN
        RAISE NOTICE '✅ All profiles have email addresses';
    ELSE
        RAISE WARNING '⚠️ Some profiles are missing email addresses';
    END IF;
END $$;