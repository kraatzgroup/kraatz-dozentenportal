-- Migration: Fix DELETE RLS policy for admins on vb_case_study_requests
-- Date: 2026-08-12
-- Purpose: The previous migration (20260812130000) only checked role = 'admin',
--   but the frontend determines admin status via allRoles = [role, ...additional_roles],
--   so a user can be admin through additional_roles as well.
--   This matches the pattern used in is_admin_or_verwaltung().
--
-- Symptom: Delete affected 0 rows / "Record STILL EXISTS after delete"
--   even though the user is an admin in the frontend.

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
'Allows admins (via role or additional_roles) to delete VB case study requests at any stage of processing';
