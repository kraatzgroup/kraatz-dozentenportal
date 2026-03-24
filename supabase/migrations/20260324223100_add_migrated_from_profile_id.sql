-- Add migrated_from_profile_id column to profiles table
-- This tracks which profile was migrated from during email change migrations

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS migrated_from_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_migrated_from ON profiles(migrated_from_profile_id);

-- Add comment
COMMENT ON COLUMN profiles.migrated_from_profile_id IS 'References the old profile ID that this profile was migrated from. Used to track migration history.';
