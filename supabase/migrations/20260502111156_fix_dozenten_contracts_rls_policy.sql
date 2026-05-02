-- Fix RLS policy for contracts to check legal area-specific dozent assignments
-- This allows dozenten to view contracts for participants they're assigned to via dozent_zivilrecht_id, dozent_strafrecht_id, or dozent_oeffentliches_recht_id

DROP POLICY IF EXISTS "Dozenten can view contracts of their teilnehmer" ON contracts;

CREATE POLICY "Dozenten can view contracts of their teilnehmer" ON contracts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM teilnehmer 
      WHERE teilnehmer.id = contracts.teilnehmer_id 
      AND (
        teilnehmer.dozent_id = auth.uid() 
        OR teilnehmer.dozent_zivilrecht_id = auth.uid() 
        OR teilnehmer.dozent_strafrecht_id = auth.uid() 
        OR teilnehmer.dozent_oeffentliches_recht_id = auth.uid()
      )
    )
  );
