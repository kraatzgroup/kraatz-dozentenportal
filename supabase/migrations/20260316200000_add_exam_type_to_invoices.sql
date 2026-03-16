-- Add exam_type column to invoices table to support separate invoices for 1st and 2nd state exam
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS exam_type TEXT CHECK (exam_type IN ('1. Staatsexamen', '2. Staatsexamen'));

-- Update the unique constraint to include exam_type
-- First drop the old constraint
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_dozent_month_year_unique;

-- Add new constraint that includes exam_type
ALTER TABLE invoices
ADD CONSTRAINT invoices_dozent_month_year_exam_type_unique 
UNIQUE (dozent_id, month, year, exam_type);

COMMENT ON COLUMN invoices.exam_type IS 'Indicates whether the invoice is for 1st or 2nd state exam activities';
