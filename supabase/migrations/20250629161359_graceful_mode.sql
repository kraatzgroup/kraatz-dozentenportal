/*
  # Add monthly assignment for files

  1. New Columns
    - `assigned_month` (integer) - Month (1-12) the file is assigned to
    - `assigned_year` (integer) - Year the file is assigned to

  2. Changes
    - Add month and year columns to files table
    - Set default values based on previous month for new files
    - Add indexes for efficient querying by month/year

  3. Security
    - Maintains existing RLS policies
*/

-- Add month and year assignment columns to files table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'assigned_month'
  ) THEN
    ALTER TABLE files ADD COLUMN assigned_month integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'assigned_year'
  ) THEN
    ALTER TABLE files ADD COLUMN assigned_year integer;
  END IF;
END $$;

-- Set default values for existing files based on their creation date
UPDATE files 
SET 
  assigned_month = CASE 
    WHEN EXTRACT(MONTH FROM created_at) = 1 THEN 12
    ELSE EXTRACT(MONTH FROM created_at) - 1
  END,
  assigned_year = CASE 
    WHEN EXTRACT(MONTH FROM created_at) = 1 THEN EXTRACT(YEAR FROM created_at) - 1
    ELSE EXTRACT(YEAR FROM created_at)
  END
WHERE assigned_month IS NULL OR assigned_year IS NULL;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_files_assigned_month_year 
ON files (assigned_month, assigned_year);

CREATE INDEX IF NOT EXISTS idx_files_folder_month_year 
ON files (folder_id, assigned_year, assigned_month);

-- Add check constraints to ensure valid month and year values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'files' AND constraint_name = 'files_assigned_month_check'
  ) THEN
    ALTER TABLE files ADD CONSTRAINT files_assigned_month_check 
      CHECK (assigned_month >= 1 AND assigned_month <= 12);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'files' AND constraint_name = 'files_assigned_year_check'
  ) THEN
    ALTER TABLE files ADD CONSTRAINT files_assigned_year_check 
      CHECK (assigned_year >= 2020 AND assigned_year <= 2100);
  END IF;
END $$;