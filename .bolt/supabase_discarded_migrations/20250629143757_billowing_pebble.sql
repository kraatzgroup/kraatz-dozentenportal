-- Connect profiles table with auth.users table and ensure email synchronization
-- This migration ensures proper relationship between profiles and auth.users

-- First, let's add a foreign key constraint to connect profiles.id with auth.users.id
-- This ensures that every profile must have a corresponding auth user
DO $$
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
    AND table_name = 'profiles'
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

-- Create a function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user's email is updated in auth.users, update it in profiles too
  IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE profiles 
    SET email = NEW.email 
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Synced email for user % from auth.users to profiles', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync email changes from auth.users to profiles
DROP TRIGGER IF EXISTS sync_user_email_trigger ON auth.users;
CREATE TRIGGER sync_user_email_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();

-- Create a function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new user is created in auth.users, create a corresponding profile
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE 
      WHEN NEW.email = 'tools@kraatz-group.de' THEN 'admin'
      ELSE 'dozent'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  RAISE NOTICE 'Created/updated profile for new user: %', NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Sync existing users' emails from auth.users to profiles
DO $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- Update profiles with emails from auth.users where they don't match
  FOR user_record IN 
    SELECT au.id, au.email as auth_email, p.email as profile_email
    FROM auth.users au
    JOIN profiles p ON au.id = p.id
    WHERE au.email IS DISTINCT FROM p.email
  LOOP
    UPDATE profiles 
    SET email = user_record.auth_email 
    WHERE id = user_record.id;
    
    updated_count := updated_count + 1;
    RAISE NOTICE 'Updated email for user %: % -> %', 
      user_record.id, user_record.profile_email, user_record.auth_email;
  END LOOP;
  
  RAISE NOTICE 'Email sync completed. Updated % profiles', updated_count;
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
      COALESCE(user_record.raw_user_meta_data->>'full_name', user_record.email),
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

-- Update the user store functions to work with the connected tables
CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  user_email text,
  user_password text,
  user_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  admin_check boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT public.is_admin() INTO admin_check;
  
  IF NOT admin_check THEN
    RAISE EXCEPTION 'Only administrators can create new users';
  END IF;
  
  -- Create the auth user (this will automatically trigger profile creation)
  SELECT id INTO new_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF new_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'User with email % already exists', user_email;
  END IF;
  
  -- Note: In a real application, you would use Supabase Admin API to create users
  -- This function is a placeholder for the logic
  RAISE NOTICE 'User creation should be handled through Supabase Admin API';
  
  RETURN new_user_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sync_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_profile(text, text, text) TO authenticated;

-- Verify the connection
DO $$
DECLARE
  profile_count INTEGER;
  auth_user_count INTEGER;
  orphaned_profiles INTEGER;
  missing_profiles INTEGER;
BEGIN
  -- Count profiles and auth users
  SELECT COUNT(*) FROM profiles INTO profile_count;
  SELECT COUNT(*) FROM auth.users INTO auth_user_count;
  
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
  
  RAISE NOTICE 'Database connection verification:';
  RAISE NOTICE '- Profiles: %', profile_count;
  RAISE NOTICE '- Auth users: %', auth_user_count;
  RAISE NOTICE '- Orphaned profiles: %', orphaned_profiles;
  RAISE NOTICE '- Missing profiles: %', missing_profiles;
  
  IF orphaned_profiles > 0 THEN
    RAISE WARNING 'Found % orphaned profiles (profiles without auth users)', orphaned_profiles;
  END IF;
  
  IF missing_profiles > 0 THEN
    RAISE WARNING 'Found % auth users without profiles', missing_profiles;
  END IF;
  
  IF orphaned_profiles = 0 AND missing_profiles = 0 THEN
    RAISE NOTICE '✅ All profiles are properly connected to auth users';
  END IF;
END $$;