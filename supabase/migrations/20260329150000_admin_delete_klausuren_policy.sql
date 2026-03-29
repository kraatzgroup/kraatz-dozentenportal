-- Migration: Add DELETE RLS policy for admins on elite_kleingruppe_klausuren
-- Date: 2026-03-29
-- Purpose: Allow admins to delete klausuren corrections at any stage

DROP POLICY IF EXISTS "Admins can delete klausuren" ON elite_kleingruppe_klausuren;

CREATE POLICY "Admins can delete klausuren"
  ON elite_kleingruppe_klausuren
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON POLICY "Admins can delete klausuren" ON elite_kleingruppe_klausuren IS 
'Allows admins to delete klausuren corrections at any stage of processing';
