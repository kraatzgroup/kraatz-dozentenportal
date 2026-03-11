-- Migration: Filter Klausuren by Dozent Legal Area
-- Date: 2026-03-11
-- Purpose: Ensure Dozenten only see Klausuren from their assigned Rechtsgebiete

-- Drop existing SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view klausuren" ON elite_kleingruppe_klausuren;
DROP POLICY IF EXISTS "Dozenten can view assigned klausuren" ON elite_kleingruppe_klausuren;

-- Create new SELECT policy that filters by legal area assignment
CREATE POLICY "Dozenten can view assigned klausuren"
  ON elite_kleingruppe_klausuren
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all klausuren
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR
    -- Dozenten can only see klausuren from their assigned legal areas
    EXISTS (
      SELECT 1 FROM elite_kleingruppe_dozenten ekd
      JOIN teilnehmer t ON t.elite_kleingruppe_id = ekd.elite_kleingruppe_id
      WHERE ekd.dozent_id = auth.uid()
      AND ekd.legal_area = elite_kleingruppe_klausuren.legal_area
      AND t.id = elite_kleingruppe_klausuren.teilnehmer_id
    )
    OR
    -- Teilnehmer can see their own klausuren
    EXISTS (
      SELECT 1 FROM teilnehmer 
      WHERE teilnehmer.id = elite_kleingruppe_klausuren.teilnehmer_id 
      AND teilnehmer.profile_id = auth.uid()
    )
  );

COMMENT ON POLICY "Dozenten can view assigned klausuren" ON elite_kleingruppe_klausuren IS 
'Allows admins to see all klausuren, dozenten to see only klausuren from their assigned legal areas, and teilnehmer to see their own klausuren';
