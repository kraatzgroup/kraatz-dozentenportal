-- Migration: Add vacation fields to profiles table
-- Created: 2026-06-26
--
-- Changes:
-- 1. Add vacation fields to profiles for dozent vacation management

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_start_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_end_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN profiles.vacation_start_date IS 'Start date of dozent vacation';
COMMENT ON COLUMN profiles.vacation_end_date IS 'End date of dozent vacation';
COMMENT ON COLUMN profiles.vacation_reason IS 'Reason for vacation';
COMMENT ON COLUMN profiles.email_notifications_enabled IS 'Whether email notifications are enabled (false during vacation)';