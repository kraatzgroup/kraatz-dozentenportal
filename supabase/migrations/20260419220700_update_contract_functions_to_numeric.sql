-- Update contract trigger functions to use NUMERIC instead of INTEGER for hours

-- Drop existing functions first
DROP FUNCTION IF EXISTS calculate_contract_hours_from_packages(UUID);
DROP FUNCTION IF EXISTS calculate_contract_booked_hours(UUID);
DROP FUNCTION IF EXISTS calculate_contract_free_hours(UUID);

-- Recreate calculate_contract_hours_from_packages
CREATE FUNCTION calculate_contract_hours_from_packages(p_contract_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_hours NUMERIC;
BEGIN
  SELECT COALESCE(SUM(hours_used), 0) INTO v_total_hours
  FROM contract_packages
  WHERE contract_id = p_contract_id;
  
  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

-- Update calculate_contract_booked_hours
CREATE OR REPLACE FUNCTION calculate_contract_booked_hours(p_contract_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_hours NUMERIC;
BEGIN
  SELECT COALESCE(SUM(hours_total), 0) INTO v_total_hours
  FROM contract_packages
  WHERE contract_id = p_contract_id;
  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

-- Update calculate_contract_free_hours
CREATE OR REPLACE FUNCTION calculate_contract_free_hours(p_contract_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_hours NUMERIC;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
  FROM free_hours
  WHERE contract_id = p_contract_id;
  
  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

-- Update contracts table total_hours column to numeric
ALTER TABLE contracts
  ALTER COLUMN total_hours TYPE numeric USING total_hours::numeric,
  ALTER COLUMN calculated_hours TYPE numeric USING calculated_hours::numeric,
  ALTER COLUMN free_hours_total TYPE numeric USING free_hours_total::numeric;

-- Update check constraint for hours
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_hours_valid;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_hours_valid CHECK (total_hours >= 0 AND calculated_hours >= 0 AND free_hours_total >= 0);
