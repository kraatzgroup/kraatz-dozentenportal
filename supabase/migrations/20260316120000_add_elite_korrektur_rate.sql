-- Migration: Add hourly_rate_elite_korrektur to profiles table
-- Description: Adds a separate hourly rate for Elite-Kleingruppe corrections
-- This allows different rates for:
-- 1. hourly_rate_unterricht (regular teaching)
-- 2. hourly_rate_elite (Elite-Kleingruppe teaching)
-- 3. hourly_rate_elite_korrektur (Elite-Kleingruppe corrections)
-- 4. hourly_rate_sonstige (other activities)

-- Add the new column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS hourly_rate_elite_korrektur DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN profiles.hourly_rate_elite_korrektur IS 'Hourly rate for Elite-Kleingruppe exam corrections (€/hour)';
