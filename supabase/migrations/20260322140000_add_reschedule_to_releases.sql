-- Add rescheduling columns to elite_kleingruppe_releases table
ALTER TABLE elite_kleingruppe_releases
ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rescheduled_to_date DATE,
ADD COLUMN IF NOT EXISTS rescheduled_to_start_time TIME,
ADD COLUMN IF NOT EXISTS rescheduled_to_end_time TIME,
ADD COLUMN IF NOT EXISTS rescheduled_reason TEXT,
ADD COLUMN IF NOT EXISTS rescheduled_by UUID REFERENCES auth.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_releases_rescheduled 
ON elite_kleingruppe_releases(is_rescheduled) 
WHERE is_rescheduled = TRUE;

-- Add comment
COMMENT ON COLUMN elite_kleingruppe_releases.is_rescheduled IS 'Indicates if this release has been rescheduled';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_at IS 'Timestamp when the release was rescheduled';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_to_date IS 'Original date before rescheduling';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_to_start_time IS 'Original start time before rescheduling';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_to_end_time IS 'Original end time before rescheduling';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_reason IS 'Reason for rescheduling';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_by IS 'User who rescheduled the release';
