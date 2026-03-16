-- Add exam_type column to dozent_hours table to distinguish between 1st and 2nd state exam activities
ALTER TABLE dozent_hours
ADD COLUMN IF NOT EXISTS exam_type TEXT CHECK (exam_type IN ('1. Staatsexamen', '2. Staatsexamen'));

COMMENT ON COLUMN dozent_hours.exam_type IS 'Indicates whether the activity relates to 1st or 2nd state exam preparation';
