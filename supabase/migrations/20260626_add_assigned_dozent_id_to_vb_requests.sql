-- Add assigned_dozent_id column to vb_case_study_requests
ALTER TABLE public.vb_case_study_requests
ADD COLUMN assigned_dozent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_vb_case_study_requests_assigned_dozent_id
ON public.vb_case_study_requests(assigned_dozent_id);
