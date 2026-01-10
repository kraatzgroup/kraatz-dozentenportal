-- Fix invoice delete policy to allow deletion of draft AND review status invoices
-- Previously only draft invoices could be deleted by dozents

-- Drop the old policy
DROP POLICY IF EXISTS "Dozents can delete their own draft invoices" ON invoices;

-- Create new policy that allows deletion of both draft and review status
CREATE POLICY "Dozents can delete their own draft or review invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (dozent_id = auth.uid() AND status IN ('draft', 'review'));
