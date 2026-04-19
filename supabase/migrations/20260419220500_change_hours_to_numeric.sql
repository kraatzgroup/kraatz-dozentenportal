-- Change hours columns in contract_packages from integer to numeric to support 0.25 hour steps

ALTER TABLE contract_packages
  ALTER COLUMN hours_total TYPE numeric USING hours_total::numeric,
  ALTER COLUMN hours_used TYPE numeric USING hours_used::numeric;

-- Update check constraint to allow decimals
ALTER TABLE contract_packages
  DROP CONSTRAINT IF EXISTS contract_packages_hours_check;

ALTER TABLE contract_packages
  ADD CONSTRAINT contract_packages_hours_check CHECK (hours_total >= 0 AND hours_used >= 0);

COMMENT ON COLUMN contract_packages.hours_total IS 'Total booked hours for this package (supports 0.25 increments)';
COMMENT ON COLUMN contract_packages.hours_used IS 'Used hours for this package (supports 0.25 increments)';
