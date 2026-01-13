-- Add duration column to trial_lessons table (in minutes)
ALTER TABLE trial_lessons ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60;
