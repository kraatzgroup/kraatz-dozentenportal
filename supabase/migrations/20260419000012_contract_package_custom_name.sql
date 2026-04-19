-- Add custom_name column to contract_packages so packages can be renamed per contract
ALTER TABLE contract_packages
ADD COLUMN IF NOT EXISTS custom_name TEXT;

COMMENT ON COLUMN contract_packages.custom_name IS 'Per-contract custom name for this package instance. Falls back to packages.name if null.';
