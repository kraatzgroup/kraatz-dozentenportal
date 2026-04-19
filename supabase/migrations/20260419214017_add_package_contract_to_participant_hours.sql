-- Add package_id and contract_id to participant_hours table
ALTER TABLE participant_hours 
ADD COLUMN contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
ADD COLUMN package_id UUID REFERENCES contract_packages(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_participant_hours_contract_id ON participant_hours(contract_id);
CREATE INDEX idx_participant_hours_package_id ON participant_hours(package_id);
