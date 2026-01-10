-- Add exam_date and state_law columns to teilnehmer table
ALTER TABLE teilnehmer
ADD COLUMN IF NOT EXISTS exam_date DATE,
ADD COLUMN IF NOT EXISTS state_law TEXT;
