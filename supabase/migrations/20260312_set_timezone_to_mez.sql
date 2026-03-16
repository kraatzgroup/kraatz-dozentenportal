-- Migration: Set database timezone to Europe/Berlin (MEZ/MESZ)
-- Created: 2026-03-12
-- Description: Configure PostgreSQL to use Central European Time

-- Set the database timezone to Europe/Berlin (MEZ in winter, MESZ in summer)
ALTER DATABASE postgres SET timezone TO 'Europe/Berlin';

-- Update the generate_pending_hours function to work with local timezone
CREATE OR REPLACE FUNCTION generate_pending_hours_from_elite_units()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  release_record RECORD;
  unit_hours DECIMAL(5,2);
  unit_description TEXT;
  current_datetime TIMESTAMP;
  release_datetime TIMESTAMP;
BEGIN
  -- Get current time in Europe/Berlin timezone
  current_datetime := NOW() AT TIME ZONE 'Europe/Berlin';
  
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
      -- Unit has ended (combine date and time, compare with current datetime in Europe/Berlin)
      AND (r.release_date + r.end_time) AT TIME ZONE 'Europe/Berlin' < current_datetime
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

COMMENT ON FUNCTION generate_pending_hours_from_elite_units() IS 'Automatically generates pending hour entries for completed Elite-Kleingruppe units. Uses Europe/Berlin timezone (MEZ/MESZ).';
