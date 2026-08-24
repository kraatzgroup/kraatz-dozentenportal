-- Migration: Create dozent_absence_requests table for short-notice absence requests
-- Created: 2026-08-24
--
-- When a dozent wants to be absent within the 14-day buffer period,
-- they submit a request that an admin must approve before the absence
-- becomes active.

CREATE TABLE IF NOT EXISTS dozent_absence_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dozent_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dozent_absence_requests_date_range CHECK (end_date >= start_date)
);

-- Index for admin dashboard: pending requests ordered by creation
CREATE INDEX IF NOT EXISTS idx_dozent_absence_requests_status
  ON dozent_absence_requests(status, created_at DESC);

-- Index for dozent: their own requests
CREATE INDEX IF NOT EXISTS idx_dozent_absence_requests_dozent
  ON dozent_absence_requests(dozent_id, created_at DESC);

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS trg_dozent_absence_requests_updated_at ON dozent_absence_requests;
CREATE OR REPLACE FUNCTION set_dozent_absence_requests_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dozent_absence_requests_updated_at
  BEFORE UPDATE ON dozent_absence_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_dozent_absence_requests_updated_at();

-- RLS: dozenten can insert and read their own requests; admins can read/update all
ALTER TABLE dozent_absence_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dozenten manage own absence requests" ON dozent_absence_requests;
CREATE POLICY "Dozenten manage own absence requests"
  ON dozent_absence_requests
  FOR ALL
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    dozent_id = auth.uid()
  );

COMMENT ON TABLE dozent_absence_requests IS 'Short-notice absence requests requiring admin approval';
