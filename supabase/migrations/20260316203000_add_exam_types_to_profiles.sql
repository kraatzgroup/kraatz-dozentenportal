-- Add exam_types array to profiles table to track which state exams a dozent teaches
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS exam_types TEXT[] DEFAULT ARRAY['1. Staatsexamen'];

COMMENT ON COLUMN profiles.exam_types IS 'Array indicating which state exams the dozent teaches (1. Staatsexamen, 2. Staatsexamen)';

-- Add constraint to ensure only valid values
ALTER TABLE profiles
ADD CONSTRAINT profiles_exam_types_check 
CHECK (
  exam_types IS NULL OR 
  (exam_types <@ ARRAY['1. Staatsexamen', '2. Staatsexamen']::TEXT[] AND array_length(exam_types, 1) > 0)
);
