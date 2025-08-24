-- Link specific user to profile and ensure email column is properly configured
-- This migration handles the specific case of linking Charlene Nowak's auth user to her profile

-- First, let's check the current state and fix the specific user linking
DO $$
DECLARE
    auth_user_id uuid := 'bfa8ed1e-edb4-4419-b917-94626982961f';
    profile_id uuid := '4b4ac71f-59d0-4f9d-8d1d-b7b8755aba66';
    user_email text := 'charlenenowak@gmx.de';
    user_name text := 'Charlene Nowak';
    auth_user_exists boolean := false;
    profile_exists boolean := false;
BEGIN
    -- Check if the auth user exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = auth_user_id) INTO auth_user_exists;
    
    -- Check if the profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = profile_id) INTO profile_exists;
    
    RAISE NOTICE 'Auth user % exists: %', auth_user_id, auth_user_exists;
    RAISE NOTICE 'Profile % exists: %', profile_id, profile_exists;
    
    IF auth_user_exists AND profile_exists THEN
        -- Both exist, we need to link them properly
        -- First, let's update the profile to use the auth user's ID
        UPDATE profiles 
        SET 
            id = auth_user_id,
            email = user_email,
            full_name = user_name
        WHERE id = profile_id;
        
        RAISE NOTICE 'Updated profile % to use auth user ID % and email %', 
            profile_id, auth_user_id, user_email;
            
    ELSIF auth_user_exists AND NOT profile_exists THEN
        -- Auth user exists but no profile, create profile with auth user ID
        INSERT INTO profiles (id, email, full_name, role, created_at)
        VALUES (auth_user_id, user_email, user_name, 'dozent', now())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name;
            
        RAISE NOTICE 'Created profile for auth user % with email %', auth_user_id, user_email;
        
    ELSIF NOT auth_user_exists AND profile_exists THEN
        -- Profile exists but no auth user - this shouldn't happen in normal flow
        RAISE WARNING 'Profile % exists but auth user % does not exist. This profile may be orphaned.', 
            profile_id, auth_user_id;
            
    ELSE
        -- Neither exists
        RAISE WARNING 'Neither auth user % nor profile % exists', auth_user_id, profile_id;
    END IF;
END $$;

-- Ensure email column exists and has proper constraints
DO $$
BEGIN
    -- Check if email column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'email'
        AND table_schema = 'public'
    ) THEN
        -- Add email column if it doesn't exist
        ALTER TABLE profiles ADD COLUMN email text;
        RAISE NOTICE 'Added email column to profiles table';
    ELSE
        RAISE NOTICE 'Email column already exists in profiles table';
    END IF;
    
    -- Ensure email column is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'email'
        AND is_nullable = 'YES'
        AND table_schema = 'public'
    ) THEN
        -- First, update any NULL emails with a default value
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
    
    -- Ensure unique constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_email_unique' 
        AND table_name = 'profiles'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
        RAISE NOTICE 'Added unique constraint to email column';
    END IF;
    
    -- Ensure email validation constraint exists
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

-- Sync all profiles with their corresponding auth users
DO $$
DECLARE
    user_record RECORD;
    sync_count INTEGER := 0;
BEGIN
    -- Update profiles with emails from auth.users where they don't match or are missing
    FOR user_record IN 
        SELECT 
            au.id, 
            au.email as auth_email, 
            p.email as profile_email,
            p.full_name
        FROM auth.users au
        JOIN profiles p ON au.id = p.id
        WHERE au.email IS DISTINCT FROM p.email OR p.email IS NULL OR p.email = ''
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

-- Create missing profiles for any auth.users that don't have profiles
DO $$
DECLARE
    user_record RECORD;
    created_count INTEGER := 0;
BEGIN
    FOR user_record IN 
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN profiles p ON au.id = p.id
        WHERE p.id IS NULL
    LOOP
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
        
        created_count := created_count + 1;
        RAISE NOTICE 'Created missing profile for user: %', user_record.email;
    END LOOP;
    
    RAISE NOTICE 'Profile creation completed. Created % profiles', created_count;
END $$;

-- Final verification
DO $$
DECLARE
    charlene_profile RECORD;
    total_profiles INTEGER;
    total_auth_users INTEGER;
    orphaned_profiles INTEGER;
    missing_profiles INTEGER;
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
    
    -- Count orphaned profiles (profiles without corresponding auth users)
    SELECT COUNT(*) 
    FROM profiles p 
    LEFT JOIN auth.users au ON p.id = au.id 
    WHERE au.id IS NULL 
    INTO orphaned_profiles;
    
    -- Count missing profiles (auth users without profiles)
    SELECT COUNT(*) 
    FROM auth.users au 
    LEFT JOIN profiles p ON au.id = p.id 
    WHERE p.id IS NULL 
    INTO missing_profiles;
    
    RAISE NOTICE 'Final verification:';
    RAISE NOTICE '- Total profiles: %', total_profiles;
    RAISE NOTICE '- Total auth users: %', total_auth_users;
    RAISE NOTICE '- Orphaned profiles: %', orphaned_profiles;
    RAISE NOTICE '- Missing profiles: %', missing_profiles;
    
    IF orphaned_profiles = 0 AND missing_profiles = 0 THEN
        RAISE NOTICE '✅ All profiles are properly linked to auth users';
    ELSE
        RAISE WARNING '⚠️ There are still unlinked profiles or auth users';
    END IF;
END $$;