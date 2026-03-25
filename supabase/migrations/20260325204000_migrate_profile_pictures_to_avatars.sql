-- Migration to copy profile pictures from profile-pictures bucket to avatars bucket
-- This is a data migration that needs to be run manually via a script

-- First, we need to update all profile_picture_url references in the profiles table
-- to point to the avatars bucket instead of profile-pictures

-- Update URLs that point to profile-pictures bucket
UPDATE profiles
SET profile_picture_url = REPLACE(profile_picture_url, '/profile-pictures/', '/avatars/')
WHERE profile_picture_url LIKE '%/profile-pictures/%';

-- Update URLs to use 'avatar' filename instead of 'profile'
UPDATE profiles
SET profile_picture_url = REGEXP_REPLACE(profile_picture_url, '/profile\.(jpg|jpeg|png|gif|webp)', '/avatar.\1', 'g')
WHERE profile_picture_url LIKE '%/profile.%';

-- Note: The actual file copying from profile-pictures to avatars bucket
-- needs to be done via the Supabase Storage API or manually in the dashboard
-- This SQL only updates the database references
