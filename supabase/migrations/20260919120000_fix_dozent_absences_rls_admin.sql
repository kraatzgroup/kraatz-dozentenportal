-- Fix RLS policy: admins must be able to insert/update/delete absences on
-- behalf of dozenten (e.g. when approving a short-notice absence request, the
-- admin dashboard inserts a dozent_absences row with the dozent's id).
-- The previous WITH CHECK only allowed dozent_id = auth.uid(), so admin
-- inserts failed silently.

DROP POLICY IF EXISTS "Dozenten manage own absences" ON dozent_absences;

-- Dozenten can read their own absences; admins/vertrieb can read all
CREATE POLICY "Dozenten read own absences"
  ON dozent_absences
  FOR SELECT
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Dozenten and admins/vertrieb can insert absences (admin: on behalf of dozenten)
CREATE POLICY "Dozenten and admins insert absences"
  ON dozent_absences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Dozenten and admins/vertrieb can update absences
CREATE POLICY "Dozenten and admins update absences"
  ON dozent_absences
  FOR UPDATE
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Dozenten and admins/vertrieb can delete absences
CREATE POLICY "Dozenten and admins delete absences"
  ON dozent_absences
  FOR DELETE
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Data repair: requests that were approved while the broken policy was active
-- never got a dozent_absences row. Backfill them (idempotent).
INSERT INTO dozent_absences (dozent_id, start_date, end_date, note)
SELECT r.dozent_id, r.start_date, r.end_date,
       COALESCE(r.reason, 'Kurzfristige Abwesenheit (genehmigt)')
FROM dozent_absence_requests r
WHERE r.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM dozent_absences a
    WHERE a.dozent_id = r.dozent_id
      AND a.start_date = r.start_date
      AND a.end_date = r.end_date
  );
