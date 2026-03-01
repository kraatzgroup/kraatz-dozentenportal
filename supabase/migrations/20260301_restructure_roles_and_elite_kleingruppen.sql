-- Migration: Restructure roles - rename elite_kleingruppe to teilnehmer and create proper relationships
-- Created: 2026-03-01

-- Step 1: Create elite_kleingruppen table for managing individual elite groups
CREATE TABLE IF NOT EXISTS elite_kleingruppen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for active groups
CREATE INDEX idx_elite_kleingruppen_active ON elite_kleingruppen(is_active);

-- Step 2: Add new columns to teilnehmer table
ALTER TABLE teilnehmer 
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_elite_kleingruppe BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elite_kleingruppe_id UUID REFERENCES elite_kleingruppen(id) ON DELETE SET NULL;

-- Add indexes for new foreign keys
CREATE INDEX IF NOT EXISTS idx_teilnehmer_profile_id ON teilnehmer(profile_id);
CREATE INDEX IF NOT EXISTS idx_teilnehmer_elite_kleingruppe_id ON teilnehmer(elite_kleingruppe_id);
CREATE INDEX IF NOT EXISTS idx_teilnehmer_is_elite_kleingruppe ON teilnehmer(is_elite_kleingruppe);

-- Step 3: Update existing elite_kleingruppe flag in teilnehmer table
-- Set is_elite_kleingruppe = true where elite_kleingruppe column is true
UPDATE teilnehmer 
SET is_elite_kleingruppe = elite_kleingruppe 
WHERE elite_kleingruppe = true;

-- Step 4: Create a default elite kleingruppe for existing members
INSERT INTO elite_kleingruppen (name, description, is_active)
VALUES ('Elite-Kleingruppe 2025/2026', 'Hauptgruppe für das Studienjahr 2025/2026', true)
ON CONFLICT DO NOTHING;

-- Step 5: Link existing elite kleingruppe members to the default group
UPDATE teilnehmer t
SET elite_kleingruppe_id = (SELECT id FROM elite_kleingruppen WHERE name = 'Elite-Kleingruppe 2025/2026' LIMIT 1)
WHERE t.is_elite_kleingruppe = true AND t.elite_kleingruppe_id IS NULL;

-- Step 6: Link existing profiles with role 'elite_kleingruppe' to teilnehmer records
-- First, try to match by email
UPDATE teilnehmer t
SET profile_id = p.id
FROM profiles p
WHERE p.role = 'elite_kleingruppe' 
  AND t.email = p.email
  AND t.profile_id IS NULL;

-- Step 7: Rename role 'elite_kleingruppe' to 'teilnehmer' in profiles table
UPDATE profiles 
SET role = 'teilnehmer' 
WHERE role = 'elite_kleingruppe';

-- Step 8: Add RLS policies for elite_kleingruppen table
ALTER TABLE elite_kleingruppen ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage elite_kleingruppen" ON elite_kleingruppen
  FOR ALL
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Dozenten can view all groups
CREATE POLICY "Dozenten can view elite_kleingruppen" ON elite_kleingruppen
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'dozent'));

-- Teilnehmer can view their own group
CREATE POLICY "Teilnehmer can view their elite_kleingruppe" ON elite_kleingruppen
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT t.elite_kleingruppe_id 
      FROM teilnehmer t 
      WHERE t.profile_id = auth.uid()
    )
  );

-- Step 9: Update existing RLS policies that reference 'elite_kleingruppe' role
-- Note: We'll need to update these manually in the application code

-- Step 10: Add trigger for updated_at on elite_kleingruppen
CREATE TRIGGER update_elite_kleingruppen_updated_at
  BEFORE UPDATE ON elite_kleingruppen
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 11: Add constraint to ensure elite_kleingruppe_id is set when is_elite_kleingruppe is true
ALTER TABLE teilnehmer
  ADD CONSTRAINT check_elite_kleingruppe_id 
  CHECK (
    (is_elite_kleingruppe = false) OR 
    (is_elite_kleingruppe = true AND elite_kleingruppe_id IS NOT NULL)
  );

COMMENT ON TABLE elite_kleingruppen IS 'Manages individual Elite-Kleingruppe groups';
COMMENT ON COLUMN teilnehmer.profile_id IS 'Links teilnehmer to their user profile if they have login access';
COMMENT ON COLUMN teilnehmer.is_elite_kleingruppe IS 'Indicates if teilnehmer is part of an Elite-Kleingruppe';
COMMENT ON COLUMN teilnehmer.elite_kleingruppe_id IS 'References the specific Elite-Kleingruppe this teilnehmer belongs to';
