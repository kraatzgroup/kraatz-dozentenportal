-- Track when the student first viewed their correction (video or written PDF).
-- Used by the student dashboard to move a Klausur from "Neue Korrektur" to
-- the viewed/below section once the student has actually opened it.
ALTER TABLE public.vb_case_study_requests
  ADD COLUMN IF NOT EXISTS correction_viewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vb_case_study_requests.correction_viewed_at IS 'Set when the student first opens/views their correction (video or PDF); moves the case out of the "Neue Korrektur" section.';
