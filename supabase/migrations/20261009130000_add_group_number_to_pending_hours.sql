-- Migration: Gruppennummer (101/102) in Tätigkeitsbericht-Beschreibungen
-- Datum: 2026-10-09
-- Die ausstehenden Bestätigungen sollen neben dem Gruppennamen auch die
-- Gruppennummer enthalten, damit man die Elite-Kleingruppe (101/102/...) eindeutig erkennt.

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
      eg.group_number as gruppe_nummer
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

    -- Build description (title + legal area + group number)
    unit_description := release_record.title;
    IF release_record.legal_area IS NOT NULL THEN
      unit_description := unit_description || ' (' || release_record.legal_area || ')';
    END IF;
    IF release_record.gruppe_nummer IS NOT NULL THEN
      unit_description := unit_description || ' - Elite-Kleingruppe ' || release_record.gruppe_nummer;
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