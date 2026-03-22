-- Add tn_nummer (Teilnehmer-Nummer) column to teilnehmer table
-- Format: TNXXXX (TN followed by 4 digits)
-- Must be unique across all participants

ALTER TABLE teilnehmer
ADD COLUMN IF NOT EXISTS tn_nummer TEXT;

-- Add unique constraint to ensure no duplicate TN numbers
ALTER TABLE teilnehmer
ADD CONSTRAINT teilnehmer_tn_nummer_unique UNIQUE (tn_nummer);

-- Add check constraint to ensure format is TNXXXX (TN + 4 digits)
ALTER TABLE teilnehmer
ADD CONSTRAINT teilnehmer_tn_nummer_format 
CHECK (tn_nummer ~ '^TN[0-9]{4}$');

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_teilnehmer_tn_nummer ON teilnehmer (tn_nummer);

-- Add comment
COMMENT ON COLUMN teilnehmer.tn_nummer IS 'Unique participant number in format TNXXXX (e.g., TN0001, TN0002)';

-- Function to get the next available TN number
CREATE OR REPLACE FUNCTION get_next_tn_nummer()
RETURNS TEXT AS $$
DECLARE
  max_number INTEGER;
  next_number INTEGER;
BEGIN
  -- Get the highest existing TN number
  SELECT COALESCE(MAX(CAST(SUBSTRING(tn_nummer FROM 3) AS INTEGER)), 0)
  INTO max_number
  FROM teilnehmer
  WHERE tn_nummer IS NOT NULL AND tn_nummer ~ '^TN[0-9]{4}$';
  
  -- Increment by 1
  next_number := max_number + 1;
  
  -- Return formatted as TNXXXX
  RETURN 'TN' || LPAD(next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_tn_nummer() IS 'Returns the next available TN number in format TNXXXX';
