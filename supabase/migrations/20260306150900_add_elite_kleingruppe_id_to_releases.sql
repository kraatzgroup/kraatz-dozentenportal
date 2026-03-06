-- Migration: Add elite_kleingruppe_id to elite_kleingruppe_releases
-- Created: 2026-03-06
-- Purpose: Link releases to specific elite groups so participants only see their group's events

-- Add elite_kleingruppe_id column
ALTER TABLE elite_kleingruppe_releases
ADD COLUMN IF NOT EXISTS elite_kleingruppe_id UUID REFERENCES elite_kleingruppen(id) ON DELETE CASCADE;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_releases_group_id 
ON elite_kleingruppe_releases(elite_kleingruppe_id);

-- Assign existing releases to the default elite group (if any exists)
UPDATE elite_kleingruppe_releases
SET elite_kleingruppe_id = (
  SELECT id FROM elite_kleingruppen 
  WHERE is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE elite_kleingruppe_id IS NULL;

-- Update RLS policies to allow participants to view releases for their group
DROP POLICY IF EXISTS "Teilnehmer can view releases for their group" ON elite_kleingruppe_releases;
CREATE POLICY "Teilnehmer can view releases for their group"
  ON elite_kleingruppe_releases
  FOR SELECT
  TO authenticated
  USING (
    elite_kleingruppe_id IN (
      SELECT t.elite_kleingruppe_id 
      FROM teilnehmer t 
      WHERE t.profile_id = auth.uid()
        AND t.is_elite_kleingruppe = true
    )
  );

COMMENT ON COLUMN elite_kleingruppe_releases.elite_kleingruppe_id IS 'References the Elite-Kleingruppe this release belongs to';
