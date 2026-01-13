-- Make scheduled_date nullable in trial_lessons table
-- This allows creating trial lesson requests without a scheduled date initially
ALTER TABLE trial_lessons ALTER COLUMN scheduled_date DROP NOT NULL;
