/*
  # Create hours tracking system for participants

  1. New Tables
    - `participant_hours`
      - `id` (uuid, primary key)
      - `teilnehmer_id` (uuid, foreign key) - Reference to participant
      - `dozent_id` (uuid, foreign key) - Reference to dozent
      - `hours` (decimal) - Number of hours worked
      - `date` (date) - Date of the work
      - `description` (text) - Optional description of work
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on participant_hours table
    - Add policies for dozent access to their own hours
    - Add policies for admin access to all hours

  3. Indexes
    - Add indexes for efficient querying by dozent, participant, and date
*/

-- Create participant_hours table
CREATE TABLE IF NOT EXISTS participant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teilnehmer_id uuid NOT NULL REFERENCES teilnehmer(id) ON DELETE CASCADE,
  dozent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hours decimal(5,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint to prevent duplicate entries for same participant on same date
ALTER TABLE participant_hours ADD CONSTRAINT participant_hours_unique_date 
  UNIQUE (teilnehmer_id, date);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_participant_hours_teilnehmer_id ON participant_hours (teilnehmer_id);
CREATE INDEX IF NOT EXISTS idx_participant_hours_dozent_id ON participant_hours (dozent_id);
CREATE INDEX IF NOT EXISTS idx_participant_hours_date ON participant_hours (date);
CREATE INDEX IF NOT EXISTS idx_participant_hours_dozent_date ON participant_hours (dozent_id, date);

-- Enable RLS
ALTER TABLE participant_hours ENABLE ROW LEVEL SECURITY;

-- Create policies for participant_hours access
CREATE POLICY "Dozenten can view their own participant hours" ON participant_hours
  FOR SELECT TO authenticated
  USING (dozent_id = auth.uid());

CREATE POLICY "Admins can view all participant hours" ON participant_hours
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Dozenten can create participant hours" ON participant_hours
  FOR INSERT TO authenticated
  WITH CHECK (
    dozent_id = auth.uid() AND
    teilnehmer_id IN (
      SELECT id FROM teilnehmer WHERE dozent_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create participant hours" ON participant_hours
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Dozenten can update their own participant hours" ON participant_hours
  FOR UPDATE TO authenticated
  USING (
    dozent_id = auth.uid() AND
    teilnehmer_id IN (
      SELECT id FROM teilnehmer WHERE dozent_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update all participant hours" ON participant_hours
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Dozenten can delete their own participant hours" ON participant_hours
  FOR DELETE TO authenticated
  USING (
    dozent_id = auth.uid() AND
    teilnehmer_id IN (
      SELECT id FROM teilnehmer WHERE dozent_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete all participant hours" ON participant_hours
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_participant_hours_updated_at
  BEFORE UPDATE ON participant_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for easy access to participant hours with names
CREATE OR REPLACE VIEW participant_hours_with_names AS
SELECT 
  ph.*,
  t.name as teilnehmer_name,
  t.email as teilnehmer_email,
  p.full_name as dozent_name
FROM participant_hours ph
JOIN teilnehmer t ON ph.teilnehmer_id = t.id
JOIN profiles p ON ph.dozent_id = p.id;

-- Grant access to the view
GRANT SELECT ON participant_hours_with_names TO authenticated;

-- Create function to get total hours for a participant in a date range
CREATE OR REPLACE FUNCTION get_participant_total_hours(
  p_teilnehmer_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
  total_hours DECIMAL;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO total_hours
  FROM participant_hours
  WHERE teilnehmer_id = p_teilnehmer_id
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date);
  
  RETURN total_hours;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get monthly hours summary for a dozent
CREATE OR REPLACE FUNCTION get_monthly_hours_summary(
  p_dozent_id UUID,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL
)
RETURNS TABLE(
  teilnehmer_id UUID,
  teilnehmer_name TEXT,
  total_hours DECIMAL,
  days_worked INTEGER
) AS $$
DECLARE
  target_year INTEGER;
  target_month INTEGER;
BEGIN
  -- Use provided year/month or default to current month
  target_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE));
  target_month := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE));

  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    COALESCE(SUM(ph.hours), 0) as total_hours,
    COUNT(ph.id)::INTEGER as days_worked
  FROM teilnehmer t
  LEFT JOIN participant_hours ph ON t.id = ph.teilnehmer_id 
    AND EXTRACT(YEAR FROM ph.date) = target_year
    AND EXTRACT(MONTH FROM ph.date) = target_month
  WHERE t.dozent_id = p_dozent_id
  GROUP BY t.id, t.name
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_participant_total_hours(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_hours_summary(UUID, INTEGER, INTEGER) TO authenticated;

-- Log the setup completion
DO $$
BEGIN
  RAISE NOTICE 'Participant hours tracking system has been set up:';
  RAISE NOTICE '- Table: participant_hours with RLS policies';
  RAISE NOTICE '- View: participant_hours_with_names for easy querying';
  RAISE NOTICE '- Function: get_participant_total_hours(teilnehmer_id, start_date, end_date)';
  RAISE NOTICE '- Function: get_monthly_hours_summary(dozent_id, year, month)';
  RAISE NOTICE '- Unique constraint: one entry per participant per date';
  RAISE NOTICE '- Hours validation: 0-24 hours per day';
END $$;