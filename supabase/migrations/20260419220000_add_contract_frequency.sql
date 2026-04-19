-- Add frequency fields to contracts table
-- These define the target hours per frequency period (e.g., monthly) per legal area

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS frequency_type text,
  ADD COLUMN IF NOT EXISTS frequency_hours_zivilrecht numeric,
  ADD COLUMN IF NOT EXISTS frequency_hours_strafrecht numeric,
  ADD COLUMN IF NOT EXISTS frequency_hours_oeffentliches_recht numeric;

-- Add check constraint for valid frequency types
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_frequency_type_check;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_frequency_type_check
  CHECK (frequency_type IS NULL OR frequency_type IN ('weekly', 'biweekly', 'monthly', 'quarterly'));

COMMENT ON COLUMN contracts.frequency_type IS 'Frequency period for target hours (weekly, biweekly, monthly, quarterly)';
COMMENT ON COLUMN contracts.frequency_hours_zivilrecht IS 'Target hours per frequency period for Zivilrecht';
COMMENT ON COLUMN contracts.frequency_hours_strafrecht IS 'Target hours per frequency period for Strafrecht';
COMMENT ON COLUMN contracts.frequency_hours_oeffentliches_recht IS 'Target hours per frequency period for Öffentliches Recht';
