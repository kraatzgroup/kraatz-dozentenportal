-- Add columns for solution PDF and scoring schema URLs to vb_case_study_requests
ALTER TABLE vb_case_study_requests 
ADD COLUMN IF NOT EXISTS solution_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS scoring_schema_url TEXT;
