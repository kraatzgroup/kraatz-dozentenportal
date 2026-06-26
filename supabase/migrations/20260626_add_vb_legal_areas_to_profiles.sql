-- Add separate legal areas field for video besprechung dozenten
ALTER TABLE profiles 
ADD COLUMN vb_legal_areas TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN profiles.vb_legal_areas IS 'Separate legal areas for video besprechung correction role. If empty, falls back to general legal_areas.';