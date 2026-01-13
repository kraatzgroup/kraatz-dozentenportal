-- Add rechtsgebiet column to trial_lessons table
ALTER TABLE trial_lessons ADD COLUMN IF NOT EXISTS rechtsgebiet TEXT DEFAULT '';

-- Add constraint for valid rechtsgebiet values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trial_lessons_rechtsgebiet_check'
  ) THEN
    ALTER TABLE trial_lessons
    ADD CONSTRAINT trial_lessons_rechtsgebiet_check
    CHECK (rechtsgebiet IN ('Zivilrecht', 'Öffentliches Recht', 'Strafrecht', ''));
  END IF;
END $$;
