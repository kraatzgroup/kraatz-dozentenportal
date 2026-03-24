-- Add is_archived column to profiles table
-- This allows keeping old profiles for history instead of deleting them during migration

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add index for filtering out archived profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_archived ON profiles(is_archived);

-- Add comment
COMMENT ON COLUMN profiles.is_archived IS 'Marks profiles that have been migrated to new auth users. Archived profiles are kept for historical reference but should not be used for active operations.';
