-- Fix RLS policy: admins must be able to update (approve/reject) absence requests
-- The previous WITH CHECK only allowed dozent_id = auth.uid(), blocking admin updates.

DROP POLICY IF EXISTS "Dozenten manage own absence requests" ON dozent_absence_requests;

-- Dozenten can insert/read their own requests
CREATE POLICY "Dozenten read own absence requests"
  ON dozent_absence_requests
  FOR SELECT
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

CREATE POLICY "Dozenten insert own absence requests"
  ON dozent_absence_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    dozent_id = auth.uid()
  );

-- Admins can update (approve/reject) any request
CREATE POLICY "Admins update absence requests"
  ON dozent_absence_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Dozenten can delete their own pending requests
CREATE POLICY "Dozenten delete own absence requests"
  ON dozent_absence_requests
  FOR DELETE
  TO authenticated
  USING (
    dozent_id = auth.uid()
  );
