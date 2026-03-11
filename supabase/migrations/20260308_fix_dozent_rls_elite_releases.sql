-- Migration: Update RLS policy for elite_kleingruppe_releases to allow all dozenten to view all releases
-- Created: 2026-03-08
--
-- The previous policy only allowed dozenten to see releases where they were assigned as dozent_id.
-- Now that we want dozenten to see all releases (like Teilnehmer), we need to update the policy.

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Dozenten können eigene Einheiten sehen" ON elite_kleingruppe_releases;
DROP POLICY IF EXISTS "Dozenten können zugewiesene Einheiten sehen" ON elite_kleingruppe_releases;
DROP POLICY IF EXISTS "Elite-Kleingruppe Dozenten können Einheiten sehen" ON elite_kleingruppe_releases;

-- Create new policy that allows all authenticated users to view releases
-- This aligns with the frontend behavior where all users see all calendar entries
CREATE POLICY "Alle Nutzer können Elite-Kleingruppe Einheiten sehen"
  ON elite_kleingruppe_releases
  FOR SELECT
  TO authenticated
  USING (true);

-- Update existing releases to have a valid dozent_id if null
-- This ensures data consistency
UPDATE elite_kleingruppe_releases 
SET dozent_id = (
  SELECT id FROM profiles 
  WHERE role = 'admin' 
  LIMIT 1
)
WHERE dozent_id IS NULL;
