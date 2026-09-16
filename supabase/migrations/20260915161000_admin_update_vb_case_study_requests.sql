-- Migration: Allow admins to UPDATE vb_case_study_requests
-- Needed so admins can manually (re)assign a case to any dozent at any stage
-- from the VB admin dashboard. Previously only dozenten with the
-- 'videobesprechung_dozent' role and case owners could update rows.

DROP POLICY IF EXISTS "Admins can update vb_case_study_requests" ON public.vb_case_study_requests;

CREATE POLICY "Admins can update vb_case_study_requests"
  ON public.vb_case_study_requests
  FOR UPDATE
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

COMMENT ON POLICY "Admins can update vb_case_study_requests" ON public.vb_case_study_requests IS
  'Allows admins (via role or additional_roles) to update VB case study requests, e.g. manual dozent assignment.';
