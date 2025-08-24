-- Remove hidden column from profiles table
ALTER TABLE profiles DROP COLUMN IF EXISTS hidden;