-- Migration: Create dozent_absences table for day-accurate absence management
-- Created: 2026-08-24
--
-- Replaces the legacy free-text "notes" availability model with a calendar
-- where dozenten can mark date ranges (e.g. vacation) by dragging across days.
-- The legacy dozent_availability table is kept for monthly max_participants.

CREATE TABLE IF NOT EXISTS dozent_absences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dozent_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dozent_absences_date_range CHECK (end_date >= start_date)
);

-- Index for the common availability lookup: is dozent X absent on date Y?
CREATE INDEX IF NOT EXISTS idx_dozent_absences_dozent_dates
  ON dozent_absences(dozent_id, start_date, end_date);

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS trg_dozent_absences_updated_at ON dozent_absences;
CREATE OR REPLACE FUNCTION set_dozent_absences_updated_at()
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

CREATE TRIGGER trg_dozent_absences_updated_at
  BEFORE UPDATE ON dozent_absences
  FOR EACH ROW
  EXECUTE FUNCTION set_dozent_absences_updated_at();

-- Row Level Security: dozenten manage their own absences; admins/vertrieb can see all
ALTER TABLE dozent_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dozenten manage own absences" ON dozent_absences;
CREATE POLICY "Dozenten manage own absences"
  ON dozent_absences
  FOR ALL
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    dozent_id = auth.uid()
  );

-- Admins/vertrieb may also insert/update on behalf of dozenten (read-only by default above
-- is covered by USING; for write we restrict to the dozent themselves via WITH CHECK).
-- If admins need to manage absences too, extend WITH CHECK accordingly.

COMMENT ON TABLE dozent_absences IS 'Day-accurate absence periods (e.g. vacation) for dozenten';
