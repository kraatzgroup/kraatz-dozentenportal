-- Migration: Add DELETE RLS policy for admins on vb_case_study_requests
-- Date: 2026-08-12
-- Purpose: Allow admins to delete VB case study requests at any stage of processing.
--
-- Cascading deletes (already defined on the FKs) will automatically remove:
--   - vb_submissions            (ON DELETE CASCADE)
--   - vb_notifications          (ON DELETE CASCADE via related_case_study_id)
--   - vb_case_study_ratings     (ON DELETE CASCADE)
-- Storage files in the "case-studies" bucket are cleaned up by the frontend
-- before the database row is deleted.

DROP POLICY IF EXISTS "Admins can delete vb_case_study_requests" ON public.vb_case_study_requests;

CREATE POLICY "Admins can delete vb_case_study_requests"
  ON public.vb_case_study_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (
          role = 'admin'
          OR additional_roles && ARRAY['admin']::text[]
        )
    )
  );

COMMENT ON POLICY "Admins can delete vb_case_study_requests" ON public.vb_case_study_requests IS
'Allows admins to delete VB case study requests (Klausurenbesprechung) at any stage of processing';
