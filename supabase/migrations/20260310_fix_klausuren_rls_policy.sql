-- Migration: Fix RLS Policy for Elite Kleingruppe Klausuren
-- Date: 2026-03-10
-- Purpose: Fix INSERT policy to allow teilnehmer with profile_id to upload klausuren

-- The issue: teilnehmer_id references the teilnehmer table, not auth.users
-- The teilnehmer table has a profile_id field that links to the user's profile
-- So we need to check if the user's auth.uid() matches the profile_id of the teilnehmer

DROP POLICY IF EXISTS "Teilnehmer can insert own klausuren" ON elite_kleingruppe_klausuren;

CREATE POLICY "Teilnehmer can insert own klausuren"
  ON elite_kleingruppe_klausuren
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if user is admin or dozent
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dozent'))
    OR
    -- Allow if user is the teilnehmer (check via profile_id in teilnehmer table)
    EXISTS (
      SELECT 1 FROM teilnehmer 
      WHERE teilnehmer.id = teilnehmer_id 
      AND teilnehmer.profile_id = auth.uid()
    )
    OR
    -- Allow if user has teilnehmer as additional role
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_has_role(auth.uid(), 'teilnehmer')
      AND EXISTS (
        SELECT 1 FROM teilnehmer 
        WHERE teilnehmer.id = teilnehmer_id 
        AND teilnehmer.profile_id = auth.uid()
      )
    )
  );

-- Also update the UPDATE policy to use the same logic
DROP POLICY IF EXISTS "Dozenten can update klausuren" ON elite_kleingruppe_klausuren;

CREATE POLICY "Dozenten can update klausuren"
  ON elite_kleingruppe_klausuren
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if user is admin or dozent
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dozent'))
    OR
    -- Allow if user is the teilnehmer (check via profile_id in teilnehmer table)
    EXISTS (
      SELECT 1 FROM teilnehmer 
      WHERE teilnehmer.id = teilnehmer_id 
      AND teilnehmer.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Allow if user is admin or dozent
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dozent'))
    OR
    -- Allow if user is the teilnehmer (check via profile_id in teilnehmer table)
    EXISTS (
      SELECT 1 FROM teilnehmer 
      WHERE teilnehmer.id = teilnehmer_id 
      AND teilnehmer.profile_id = auth.uid()
    )
  );

COMMENT ON POLICY "Teilnehmer can insert own klausuren" ON elite_kleingruppe_klausuren IS 
'Allows teilnehmer to upload their own klausuren by checking profile_id in teilnehmer table, or allows admin/dozent to upload on behalf of teilnehmer';

COMMENT ON POLICY "Dozenten can update klausuren" ON elite_kleingruppe_klausuren IS 
'Allows teilnehmer to update their own klausuren and dozenten/admins to update any klausuren';
