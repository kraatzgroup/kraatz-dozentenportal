-- Add case_study_material_file_name to store original filename from teaching materials
ALTER TABLE vb_case_study_requests 
ADD COLUMN case_study_material_file_name TEXT;

-- Add index for faster lookups
CREATE INDEX idx_vb_case_study_requests_material_file_name ON vb_case_study_requests(case_study_material_file_name);