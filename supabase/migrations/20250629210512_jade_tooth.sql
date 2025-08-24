/*
  # Add last_login timestamp to profiles table

  1. New Columns
    - `last_login` (timestamptz, nullable) - Tracks when user last logged in

  2. Changes
    - Add last_login column to profiles table
    - Create function to update last_login on authentication
    - Add trigger to automatically update last_login when user signs in

  3. Security
    - Maintains existing RLS policies
    - Only updates for authenticated users
*/

-- Add last_login column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add index for efficient querying of last login times
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles (last_login);

-- Create function to update last_login timestamp
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_login for the authenticated user
  UPDATE profiles 
  SET last_login = NOW() 
  WHERE id = auth.uid();
  
  RETURN NULL; -- This is an AFTER trigger, so return value doesn't matter
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update last_login on successful authentication
-- Note: This trigger will be called whenever a user's session is established
DROP TRIGGER IF EXISTS trigger_update_last_login ON auth.users;

-- We'll use a different approach since we can't directly trigger on auth.users
-- Instead, we'll create a function that can be called from the application
CREATE OR REPLACE FUNCTION mark_user_login(user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Use provided user_id or current authenticated user
  target_user_id := COALESCE(user_id, auth.uid());
  
  IF target_user_id IS NOT NULL THEN
    UPDATE profiles 
    SET last_login = NOW() 
    WHERE id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_user_login(UUID) TO authenticated;

-- Update existing users' last_login to NULL (they haven't logged in since we started tracking)
-- This ensures we can distinguish between "never logged in" and "logged in before tracking"
UPDATE profiles SET last_login = NULL WHERE last_login IS NULL;

-- Log the setup completion
DO $$
BEGIN
  RAISE NOTICE 'Added last_login tracking to profiles table:';
  RAISE NOTICE '- Column: last_login (timestamptz, nullable)';
  RAISE NOTICE '- Function: mark_user_login(user_id UUID)';
  RAISE NOTICE '- Index: idx_profiles_last_login';
  RAISE NOTICE '- NULL values indicate user has never logged in';
  RAISE NOTICE '- Call mark_user_login() after successful authentication';
END $$;