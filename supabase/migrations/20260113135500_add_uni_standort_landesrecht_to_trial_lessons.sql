-- Add uni_standort and landesrecht columns to trial_lessons table
ALTER TABLE trial_lessons ADD COLUMN IF NOT EXISTS uni_standort TEXT;
ALTER TABLE trial_lessons ADD COLUMN IF NOT EXISTS landesrecht TEXT;
