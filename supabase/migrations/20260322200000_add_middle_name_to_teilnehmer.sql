-- Add middle_name column to teilnehmer table
ALTER TABLE teilnehmer ADD COLUMN IF NOT EXISTS middle_name TEXT;

-- Add comment
COMMENT ON COLUMN teilnehmer.middle_name IS 'Middle name of the participant';
