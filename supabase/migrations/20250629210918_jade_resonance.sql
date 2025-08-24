/*
  # Add last_login column to profiles table

  1. New Columns
    - `last_login` (timestamptz, nullable) - Tracks when a user last logged in

  2. Functions
    - `mark_user_login(user_id UUID)` - Function to update the last_login timestamp

  3. Security
    - Function is SECURITY DEFINER to ensure it can be called by authenticated users
    - Index added for efficient querying
*/

-- Add last_login column to profiles table if it doesn't exist
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