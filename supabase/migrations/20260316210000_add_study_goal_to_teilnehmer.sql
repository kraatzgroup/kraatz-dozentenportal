-- Add study_goal column to teilnehmer table
-- This field stores which Staatsexamen the participant is studying for
-- Used to filter hours in activity reports and invoices

ALTER TABLE teilnehmer
ADD COLUMN IF NOT EXISTS study_goal TEXT;

-- Add comment
COMMENT ON COLUMN teilnehmer.study_goal IS 'Which Staatsexamen the participant is studying for (e.g., "1. Staatsexamen", "2. Staatsexamen")';
