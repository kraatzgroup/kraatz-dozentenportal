-- Migration: Enhance duplicate prevention for pending hours
-- Created: 2026-03-16
-- Description: Prevents duplicate pending entries even for rejected units

-- Step 1: Update the generate_pending_hours function with enhanced duplicate check
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
      -- ENHANCED DUPLICATE CHECK: No pending entry exists (any status)
      AND NOT EXISTS (
        SELECT 1 FROM pending_dozent_hours pdh
        WHERE pdh.elite_release_id = r.id
        AND pdh.dozent_id = r.dozent_id
        -- Check all statuses to prevent re-adding rejected units
      )
      -- No confirmed entry exists in dozent_hours
      AND NOT EXISTS (
        SELECT 1 FROM dozent_hours dh
        WHERE dh.date = r.release_date
        AND dh.dozent_id = r.dozent_id
        AND (
          -- Exact match on description
          dh.description = (
            r.title || 
            CASE WHEN r.legal_area IS NOT NULL THEN ' (' || r.legal_area || ')' ELSE '' END ||
            CASE WHEN eg.name IS NOT NULL THEN ' - ' || eg.name ELSE '' END
          )
          -- Or partial match (for backwards compatibility)
          OR dh.description LIKE '%' || r.title || '%'
        )
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

    -- Insert pending hour entry with ON CONFLICT to prevent race conditions
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

-- Step 2: Add index to improve duplicate check performance
CREATE INDEX IF NOT EXISTS idx_pending_dozent_hours_release_dozent 
ON pending_dozent_hours(elite_release_id, dozent_id);

-- Step 3: Add index on dozent_hours for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_dozent_hours_date_dozent_desc 
ON dozent_hours(date, dozent_id, description);

-- Step 4: Create a view to show all units and their status
CREATE OR REPLACE VIEW elite_units_status AS
SELECT 
  r.id as release_id,
  r.title,
  r.release_date,
  r.start_time,
  r.end_time,
  r.unit_type,
  r.legal_area,
  r.dozent_id,
  p.full_name as dozent_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM dozent_hours dh 
      WHERE dh.date = r.release_date 
      AND dh.dozent_id = r.dozent_id 
      AND dh.description LIKE '%' || r.title || '%'
    ) THEN 'confirmed'
    WHEN EXISTS (
      SELECT 1 FROM pending_dozent_hours pdh 
      WHERE pdh.elite_release_id = r.id 
      AND pdh.dozent_id = r.dozent_id 
      AND pdh.status = 'pending'
    ) THEN 'pending'
    WHEN EXISTS (
      SELECT 1 FROM pending_dozent_hours pdh 
      WHERE pdh.elite_release_id = r.id 
      AND pdh.dozent_id = r.dozent_id 
      AND pdh.status = 'rejected'
    ) THEN 'rejected'
    WHEN (r.release_date + r.end_time) AT TIME ZONE 'Europe/Berlin' < NOW() AT TIME ZONE 'Europe/Berlin' 
    THEN 'completed_not_processed'
    ELSE 'scheduled'
  END as status
FROM elite_kleingruppe_releases r
LEFT JOIN profiles p ON r.dozent_id = p.id
WHERE r.event_type = 'einheit'
ORDER BY r.release_date DESC, r.start_time DESC;

-- Step 5: Add comments
COMMENT ON FUNCTION generate_pending_hours_from_elite_units() IS 'Enhanced version with improved duplicate prevention. Checks all pending_dozent_hours statuses (pending, confirmed, rejected) to prevent re-adding units.';
COMMENT ON VIEW elite_units_status IS 'Shows all Elite-Kleingruppe units with their current processing status (scheduled, pending, confirmed, rejected, completed_not_processed)';

-- Step 6: Grant permissions on the view
GRANT SELECT ON elite_units_status TO authenticated;
