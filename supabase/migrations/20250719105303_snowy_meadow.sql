/*
  # Add legal_area column to participant_hours table

  1. Changes
    - Add `legal_area` column to `participant_hours` table
    - Set default value to empty string
    - Add check constraint to only allow specific legal areas

  2. Legal Areas
    - Zivilrecht
    - Öffentliches Recht  
    - Strafrecht
*/

-- Add legal_area column to participant_hours table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participant_hours' AND column_name = 'legal_area'
  ) THEN
    ALTER TABLE participant_hours ADD COLUMN legal_area text DEFAULT '';
  END IF;
END $$;

-- Add check constraint for legal areas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'participant_hours_legal_area_check'
  ) THEN
    ALTER TABLE participant_hours 
    ADD CONSTRAINT participant_hours_legal_area_check 
    CHECK (legal_area IN ('Zivilrecht', 'Öffentliches Recht', 'Strafrecht', ''));
  END IF;
END $$;