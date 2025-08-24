/*
  # Add first_login_completed column to profiles table

  1. New Columns
    - `first_login_completed` (boolean, not null, default false) - Tracks if user has completed their first login setup

  2. Changes
    - Add first_login_completed column to profiles table
    - Set existing users with last_login to true (they've already logged in)
    - Set column to NOT NULL after population

  3. Security
    - Maintains existing RLS policies
    - Column defaults to false for new users
*/

-- Add first_login_completed column to profiles table (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'first_login_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN first_login_completed boolean DEFAULT false;
  END IF;
END $$;

-- Update existing profiles that have logged in before to mark first login as completed
UPDATE profiles 
SET first_login_completed = true
WHERE last_login IS NOT NULL;

-- Set default to false for any remaining NULL values
UPDATE profiles 
SET first_login_completed = false
WHERE first_login_completed IS NULL;

-- Now make the column NOT NULL since all rows have values
ALTER TABLE profiles ALTER COLUMN first_login_completed SET NOT NULL;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_profiles_first_login_completed ON profiles (first_login_completed);

-- Create function to mark first login as completed
CREATE OR REPLACE FUNCTION mark_first_login_completed(user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Use provided user_id or current authenticated user
  target_user_id := COALESCE(user_id, auth.uid());
  
  IF target_user_id IS NOT NULL THEN
    UPDATE profiles 
    SET first_login_completed = true
    WHERE id = target_user_id AND first_login_completed = false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_first_login_completed(UUID) TO authenticated;

-- Log the setup completion
DO $$
BEGIN
  RAISE NOTICE 'Added first_login_completed tracking to profiles table:';
  RAISE NOTICE '- Column: first_login_completed (boolean, not null, default false)';
  RAISE NOTICE '- Function: mark_first_login_completed(user_id UUID)';
  RAISE NOTICE '- Index: idx_profiles_first_login_completed';
  RAISE NOTICE '- Existing users with last_login set to completed';
  RAISE NOTICE '- New users default to false (incomplete)';
END $$;