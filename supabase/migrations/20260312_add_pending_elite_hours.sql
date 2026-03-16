-- Migration: Add pending Elite-Kleingruppe hours for dozent confirmation
-- Created: 2026-03-12
-- Description: Automatically creates pending hour entries when Elite-Kleingruppe units end

-- Step 1: Create pending_dozent_hours table
CREATE TABLE IF NOT EXISTS pending_dozent_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dozent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  elite_release_id UUID NOT NULL REFERENCES elite_kleingruppe_releases(id) ON DELETE CASCADE,
  hours DECIMAL(5,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'Elite-Kleingruppe Unterricht',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dozent_id, elite_release_id) -- Prevent duplicates for same dozent and release
);

-- Add indexes for performance
CREATE INDEX idx_pending_dozent_hours_dozent ON pending_dozent_hours(dozent_id);
CREATE INDEX idx_pending_dozent_hours_status ON pending_dozent_hours(status);
CREATE INDEX idx_pending_dozent_hours_date ON pending_dozent_hours(date DESC);
CREATE INDEX idx_pending_dozent_hours_release ON pending_dozent_hours(elite_release_id);

-- Enable RLS
ALTER TABLE pending_dozent_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can see all pending hours
CREATE POLICY "Admins can manage all pending hours" ON pending_dozent_hours
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Dozenten can see and manage their own pending hours
CREATE POLICY "Dozenten can view their pending hours" ON pending_dozent_hours
  FOR SELECT
  TO authenticated
  USING (dozent_id = auth.uid());

CREATE POLICY "Dozenten can update their pending hours" ON pending_dozent_hours
  FOR UPDATE
  TO authenticated
  USING (dozent_id = auth.uid());

CREATE POLICY "Dozenten can delete their pending hours" ON pending_dozent_hours
  FOR DELETE
  TO authenticated
  USING (dozent_id = auth.uid());

-- Buchhaltung can view all pending hours
CREATE POLICY "Buchhaltung can view all pending hours" ON pending_dozent_hours
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (role = 'buchhaltung' OR 'buchhaltung' = ANY(additional_roles))
    )
  );

-- Step 2: Create function to generate pending hours from completed units
CREATE OR REPLACE FUNCTION generate_pending_hours_from_elite_units()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  release_record RECORD;
  unit_hours DECIMAL(5,2);
  unit_description TEXT;
BEGIN
  -- Find all completed units (einheit type, end_time has passed, dozent assigned)
  -- that don't already have a pending entry
  FOR release_record IN
    SELECT 
      r.id,
      r.dozent_id,
      r.release_date,
      r.start_time,
      r.end_time,
      r.duration_minutes,
      r.title,
      r.unit_type,
      r.legal_area,
      r.elite_kleingruppe_id,
      eg.name as gruppe_name
    FROM elite_kleingruppe_releases r
    LEFT JOIN elite_kleingruppen eg ON r.elite_kleingruppe_id = eg.id
    WHERE r.event_type = 'einheit'
      AND r.dozent_id IS NOT NULL
      AND r.end_time IS NOT NULL
      AND r.release_date IS NOT NULL
      -- Unit has ended (date is in the past OR date is today and end_time has passed)
      AND (
        r.release_date < CURRENT_DATE
        OR (r.release_date = CURRENT_DATE AND r.end_time < CURRENT_TIME)
      )
      -- No pending entry exists yet
      AND NOT EXISTS (
        SELECT 1 FROM pending_dozent_hours pdh
        WHERE pdh.elite_release_id = r.id
        AND pdh.dozent_id = r.dozent_id
      )
      -- No confirmed entry exists yet
      AND NOT EXISTS (
        SELECT 1 FROM dozent_hours dh
        WHERE dh.date = r.release_date
        AND dh.dozent_id = r.dozent_id
        AND dh.description LIKE '%' || r.title || '%'
      )
  LOOP
    -- Calculate hours from duration_minutes
    IF release_record.duration_minutes IS NOT NULL THEN
      unit_hours := release_record.duration_minutes / 60.0;
    ELSIF release_record.start_time IS NOT NULL AND release_record.end_time IS NOT NULL THEN
      -- Calculate from time difference
      unit_hours := EXTRACT(EPOCH FROM (release_record.end_time - release_record.start_time)) / 3600.0;
    ELSE
      -- Default fallback
      unit_hours := 2.5;
    END IF;

    -- Build description
    unit_description := release_record.title;
    IF release_record.legal_area IS NOT NULL THEN
      unit_description := unit_description || ' (' || release_record.legal_area || ')';
    END IF;
    IF release_record.gruppe_name IS NOT NULL THEN
      unit_description := unit_description || ' - ' || release_record.gruppe_name;
    END IF;

    -- Insert pending hour entry
    INSERT INTO pending_dozent_hours (
      dozent_id,
      elite_release_id,
      hours,
      date,
      description,
      category,
      status
    ) VALUES (
      release_record.dozent_id,
      release_record.id,
      unit_hours,
      release_record.release_date,
      unit_description,
      'Elite-Kleingruppe Unterricht',
      'pending'
    )
    ON CONFLICT (dozent_id, elite_release_id) DO NOTHING;

    RAISE NOTICE 'Created pending hours for dozent % on %: % hours', 
      release_record.dozent_id, release_record.release_date, unit_hours;
  END LOOP;
END;
$$;

-- Step 3: Create function to confirm pending hours (converts to dozent_hours)
CREATE OR REPLACE FUNCTION confirm_pending_hours(pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record RECORD;
BEGIN
  -- Get the pending record
  SELECT * INTO pending_record
  FROM pending_dozent_hours
  WHERE id = pending_id
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending hour entry not found or already processed';
  END IF;

  -- Insert into dozent_hours
  INSERT INTO dozent_hours (
    dozent_id,
    hours,
    date,
    description,
    category
  ) VALUES (
    pending_record.dozent_id,
    pending_record.hours,
    pending_record.date,
    pending_record.description,
    pending_record.category
  );

  -- Update status to confirmed
  UPDATE pending_dozent_hours
  SET status = 'confirmed',
      updated_at = NOW()
  WHERE id = pending_id;

  RAISE NOTICE 'Confirmed pending hours: %', pending_id;
END;
$$;

-- Step 4: Create function to reject pending hours
CREATE OR REPLACE FUNCTION reject_pending_hours(pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update status to rejected
  UPDATE pending_dozent_hours
  SET status = 'rejected',
      updated_at = NOW()
  WHERE id = pending_id
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending hour entry not found or already processed';
  END IF;

  RAISE NOTICE 'Rejected pending hours: %', pending_id;
END;
$$;

-- Step 5: Add trigger for updated_at
CREATE TRIGGER update_pending_dozent_hours_updated_at
  BEFORE UPDATE ON pending_dozent_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Add comments
COMMENT ON TABLE pending_dozent_hours IS 'Pending hour entries from Elite-Kleingruppe units that need dozent confirmation';
COMMENT ON COLUMN pending_dozent_hours.status IS 'pending: awaiting confirmation, confirmed: converted to dozent_hours, rejected: dismissed by dozent';
COMMENT ON FUNCTION generate_pending_hours_from_elite_units() IS 'Automatically generates pending hour entries for completed Elite-Kleingruppe units';
COMMENT ON FUNCTION confirm_pending_hours(UUID) IS 'Confirms a pending hour entry and converts it to dozent_hours';
COMMENT ON FUNCTION reject_pending_hours(UUID) IS 'Rejects a pending hour entry';

-- Step 7: Run initial generation for existing completed units
SELECT generate_pending_hours_from_elite_units();
