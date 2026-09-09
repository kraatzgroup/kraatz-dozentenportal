-- Add submitted_at column to track when a student actually submitted their work.
-- Before this, the frontend showed created_at (request creation time) as
-- "Eingereicht", which is wrong — created_at is when the case study was
-- requested, not when the Bearbeitung was uploaded.
--
-- Backfill: for existing records with status 'submitted' (or later), use
-- updated_at as the best approximation of when the submission happened.

ALTER TABLE public.vb_case_study_requests
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vb_case_study_requests.submitted_at IS
  'Timestamp when the student uploaded their Bearbeitung (status set to submitted).';

-- Backfill existing submitted records
UPDATE public.vb_case_study_requests
SET submitted_at = updated_at
WHERE submitted_at IS NULL
  AND status IN ('submitted', 'under_review', 'corrected', 'completed')
  AND submission_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vb_case_study_requests_submitted_at
  ON public.vb_case_study_requests (submitted_at DESC)
  WHERE submitted_at IS NOT NULL;
