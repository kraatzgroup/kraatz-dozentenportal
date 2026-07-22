-- Track when the student downloaded the Sachverhalt itself (separate from
-- pdf_downloaded_at, which is set by any tracked download incl. corrections).
-- Used to gate the "Upload Bearbeitung" section on the student dashboard.
ALTER TABLE public.vb_case_study_requests
  ADD COLUMN IF NOT EXISTS case_study_downloaded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vb_case_study_requests.case_study_downloaded_at IS 'Set when the student first downloads the Sachverhalt; unlocks the submission upload UI.';
