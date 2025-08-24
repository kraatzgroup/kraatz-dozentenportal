/*
  # Create dozent_hours table for additional activities

  1. New Tables
    - `dozent_hours`
      - `id` (uuid, primary key)
      - `dozent_id` (uuid, foreign key to profiles)
      - `hours` (numeric, 0-24 hours)
      - `date` (date)
      - `description` (text, activity description)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `dozent_hours` table
    - Add policies for dozenten to manage their own hours
    - Add policies for admins to view all hours

  3. Indexes
    - Index on dozent_id for efficient queries
    - Index on date for chronological sorting
    - Composite index on dozent_id and date
*/

CREATE TABLE IF NOT EXISTS dozent_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dozent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hours numeric(5,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE dozent_hours ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dozent_hours_dozent_id ON dozent_hours(dozent_id);
CREATE INDEX IF NOT EXISTS idx_dozent_hours_date ON dozent_hours(date);
CREATE INDEX IF NOT EXISTS idx_dozent_hours_dozent_date ON dozent_hours(dozent_id, date);

-- RLS Policies for Dozenten
CREATE POLICY "Dozenten can view their own hours"
  ON dozent_hours
  FOR SELECT
  TO authenticated
  USING (dozent_id = auth.uid());

CREATE POLICY "Dozenten can create their own hours"
  ON dozent_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (dozent_id = auth.uid());

CREATE POLICY "Dozenten can update their own hours"
  ON dozent_hours
  FOR UPDATE
  TO authenticated
  USING (dozent_id = auth.uid())
  WITH CHECK (dozent_id = auth.uid());

CREATE POLICY "Dozenten can delete their own hours"
  ON dozent_hours
  FOR DELETE
  TO authenticated
  USING (dozent_id = auth.uid());

-- RLS Policies for Admins
CREATE POLICY "Admins can view all dozent hours"
  ON dozent_hours
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Admins can create dozent hours"
  ON dozent_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Admins can update all dozent hours"
  ON dozent_hours
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Admins can delete all dozent hours"
  ON dozent_hours
  FOR DELETE
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_dozent_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dozent_hours_updated_at_trigger
  BEFORE UPDATE ON dozent_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_dozent_hours_updated_at();