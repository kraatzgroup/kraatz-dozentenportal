-- Add start_date and end_date columns to contract_packages
ALTER TABLE contract_packages
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add comments
COMMENT ON COLUMN contract_packages.start_date IS 'Start date of the package validity period';
COMMENT ON COLUMN contract_packages.end_date IS 'End date of the package validity period';
