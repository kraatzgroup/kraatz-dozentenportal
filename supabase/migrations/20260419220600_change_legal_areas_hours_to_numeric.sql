-- Change hours column in contract_package_legal_areas from integer to numeric to support 0.25 hour steps

ALTER TABLE contract_package_legal_areas
  ALTER COLUMN hours TYPE numeric USING hours::numeric;

-- Update check constraint to allow decimals
ALTER TABLE contract_package_legal_areas
  DROP CONSTRAINT IF EXISTS contract_package_legal_areas_hours_check;

ALTER TABLE contract_package_legal_areas
  ADD CONSTRAINT contract_package_legal_areas_hours_check CHECK (hours >= 0);

COMMENT ON COLUMN contract_package_legal_areas.hours IS 'Hours for this legal area (supports 0.25 increments)';
