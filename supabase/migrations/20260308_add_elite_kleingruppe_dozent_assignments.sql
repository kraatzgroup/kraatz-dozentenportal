-- Migration: Add elite_kleingruppe_id to dozent assignments and create detailed assignment table
-- Created: 2026-03-08

-- Add elite_kleingruppe_id to existing table (nullable first for migration)
ALTER TABLE elite_kleingruppe_dozenten 
ADD COLUMN IF NOT EXISTS elite_kleingruppe_id uuid REFERENCES elite_kleingruppen(id) ON DELETE CASCADE;

-- Create new table for detailed dozent assignments with per-group legal areas
CREATE TABLE IF NOT EXISTS elite_kleingruppe_dozent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dozent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  elite_kleingruppe_id uuid NOT NULL REFERENCES elite_kleingruppen(id) ON DELETE CASCADE,
  legal_areas text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dozent_id, elite_kleingruppe_id)
);

-- Enable RLS
ALTER TABLE elite_kleingruppe_dozent_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage dozent assignments"
  ON elite_kleingruppe_dozent_assignments
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Dozenten can view their own assignments"
  ON elite_kleingruppe_dozent_assignments
  FOR SELECT
  TO authenticated
  USING (dozent_id = auth.uid());

-- Migrate existing data: populate elite_kleingruppe_id from the only existing group if any
DO $$
DECLARE
  default_group_id uuid;
BEGIN
  SELECT id INTO default_group_id FROM elite_kleingruppen LIMIT 1;
  IF default_group_id IS NOT NULL THEN
    UPDATE elite_kleingruppe_dozenten 
    SET elite_kleingruppe_id = default_group_id 
    WHERE elite_kleingruppe_id IS NULL;
  END IF;
END $$;
