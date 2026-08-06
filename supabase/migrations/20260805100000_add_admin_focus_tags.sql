-- Migration: Add admin_focus_tags column to vb_case_study_requests
-- Description: Allows admins and material role users to tag klausuren with
-- multiple schwerpunkt tags for better classification.

ALTER TABLE public.vb_case_study_requests
  ADD COLUMN IF NOT EXISTS admin_focus_tags TEXT[] DEFAULT '{}';

-- Index for fast tag-based filtering
CREATE INDEX IF NOT EXISTS idx_vb_case_study_requests_admin_focus_tags
  ON public.vb_case_study_requests USING GIN (admin_focus_tags);

-- Allow admin and material roles to update the admin_focus_tags column
-- (RLS policies for the table already exist; this just ensures the column
--  is accessible to the existing update policies.)
