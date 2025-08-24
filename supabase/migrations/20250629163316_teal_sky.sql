/*
  # Add Teilnehmer table for participant management

  1. New Tables
    - `teilnehmer`
      - `id` (uuid, primary key)
      - `name` (text, not null) - Full name of the participant
      - `email` (text, not null) - Email address
      - `active_since` (date, not null) - Date when participant became active
      - `dozent_id` (uuid, foreign key) - Reference to the dozent (profiles table)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes
    - Add foreign key constraint to profiles table
    - Add unique constraint on email per dozent
    - Add indexes for efficient querying

  3. Security
    - Enable RLS on teilnehmer table
    - Add policies for dozent access to their own participants
    - Add policies for admin access to all participants
*/

-- Create teilnehmer table
CREATE TABLE IF NOT EXISTS teilnehmer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  active_since date NOT NULL DEFAULT CURRENT_DATE,
  dozent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on email per dozent (same participant can't be added twice by same dozent)
ALTER TABLE teilnehmer ADD CONSTRAINT teilnehmer_email_dozent_unique 
  UNIQUE (email, dozent_id);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_teilnehmer_dozent_id ON teilnehmer (dozent_id);
CREATE INDEX IF NOT EXISTS idx_teilnehmer_email ON teilnehmer (email);
CREATE INDEX IF NOT EXISTS idx_teilnehmer_active_since ON teilnehmer (active_since);

-- Enable RLS
ALTER TABLE teilnehmer ENABLE ROW LEVEL SECURITY;

-- Create policies for teilnehmer access
CREATE POLICY "Dozenten can view their own teilnehmer" ON teilnehmer
  FOR SELECT TO authenticated
  USING (dozent_id = auth.uid());

CREATE POLICY "Admins can view all teilnehmer" ON teilnehmer
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Dozenten can create teilnehmer" ON teilnehmer
  FOR INSERT TO authenticated
  WITH CHECK (
    dozent_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Dozenten can update their own teilnehmer" ON teilnehmer
  FOR UPDATE TO authenticated
  USING (
    dozent_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Dozenten can delete their own teilnehmer" ON teilnehmer
  FOR DELETE TO authenticated
  USING (
    dozent_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teilnehmer_updated_at
  BEFORE UPDATE ON teilnehmer
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add teilnehmer_id column to files table for assignment to participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'teilnehmer_id'
  ) THEN
    ALTER TABLE files ADD COLUMN teilnehmer_id uuid REFERENCES teilnehmer(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for teilnehmer_id in files
CREATE INDEX IF NOT EXISTS idx_files_teilnehmer_id ON files (teilnehmer_id);