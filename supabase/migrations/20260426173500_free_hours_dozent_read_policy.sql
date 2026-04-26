/*
  # Dozenten dürfen free_hours ihrer Teilnehmer lesen
  
  Bisher: free_hours waren Admin-only.
  Neu: Dozenten dürfen free_hours für Verträge ihrer Teilnehmer SELECT-en,
  damit Anzeigen wie "13 / 145h" auch Freistunden korrekt einbeziehen.
*/

DROP POLICY IF EXISTS "Dozenten can read free_hours of their teilnehmer" ON free_hours;
CREATE POLICY "Dozenten can read free_hours of their teilnehmer" ON free_hours
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN teilnehmer t ON t.id = c.teilnehmer_id
      WHERE c.id = free_hours.contract_id
        AND (
          t.dozent_id = auth.uid()
          OR t.dozent_zivilrecht_id = auth.uid()
          OR t.dozent_strafrecht_id = auth.uid()
          OR t.dozent_oeffentliches_recht_id = auth.uid()
        )
    )
  );
