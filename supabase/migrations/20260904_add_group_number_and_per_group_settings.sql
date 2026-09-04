-- Migration: Add group_number to elite_kleingruppen and make settings/course_times/dozent_hours group-specific
-- Created: 2026-09-04
-- Purpose: Support multiple parallel Elite-Kleingruppen with different group numbers (e.g. 101, 102)

-- =============================================================================
-- Step 1: Add group_number column to elite_kleingruppen
-- =============================================================================
ALTER TABLE elite_kleingruppen
  ADD COLUMN IF NOT EXISTS group_number TEXT;

-- Backfill existing group with number 101
UPDATE elite_kleingruppen
SET group_number = '101'
WHERE group_number IS NULL
  AND name ILIKE '%2025/2026%';

-- For any remaining rows without a number, assign the next available number
UPDATE elite_kleingruppen
SET group_number = '101'
WHERE group_number IS NULL;

-- Add unique constraint on group_number (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_elite_kleingruppen_group_number_unique
  ON elite_kleingruppen(group_number)
  WHERE group_number IS NOT NULL;

COMMENT ON COLUMN elite_kleingruppen.group_number IS 'Short group number shown alongside the name (e.g. 101, 102)';

-- =============================================================================
-- Step 1b: Update unique constraint on elite_kleingruppe_dozenten to include group
-- =============================================================================
-- The old constraint UNIQUE(dozent_id, legal_area) prevented a dozent from being
-- assigned to multiple groups for the same legal area. Replace with a 3-column constraint.
ALTER TABLE elite_kleingruppe_dozenten
  DROP CONSTRAINT IF EXISTS elite_kleingruppe_dozenten_dozent_id_legal_area_key;
ALTER TABLE elite_kleingruppe_dozenten
  ADD CONSTRAINT elite_kleingruppe_dozenten_dozent_id_legal_area_group_key
  UNIQUE (dozent_id, legal_area, elite_kleingruppe_id);

-- =============================================================================
-- Step 2: Make elite_kleingruppe_settings group-specific for zoom_links
--          (unit_durations stays global with elite_kleingruppe_id = NULL)
-- =============================================================================
ALTER TABLE elite_kleingruppe_settings
  ADD COLUMN IF NOT EXISTS elite_kleingruppe_id UUID REFERENCES elite_kleingruppen(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_settings_group_id
  ON elite_kleingruppe_settings(elite_kleingruppe_id);

-- Assign existing zoom_links setting to the first (default) group
UPDATE elite_kleingruppe_settings
SET elite_kleingruppe_id = (
  SELECT id FROM elite_kleingruppen
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE setting_key = 'zoom_links'
  AND elite_kleingruppe_id IS NULL;

-- Composite unique constraint: one zoom_links row per group (and one global row for unit_durations)
DROP INDEX IF EXISTS idx_elite_kleingruppe_settings_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_elite_kleingruppe_settings_key_group_unique
  ON elite_kleingruppe_settings(setting_key, COALESCE(elite_kleingruppe_id, '00000000-0000-0000-0000-000000000000'));

COMMENT ON COLUMN elite_kleingruppe_settings.elite_kleingruppe_id IS 'When set, the setting applies to a specific group. NULL means global (e.g. unit_durations).';

-- =============================================================================
-- Step 3: Make elite_course_times group-specific
-- =============================================================================
ALTER TABLE elite_course_times
  ADD COLUMN IF NOT EXISTS elite_kleingruppe_id UUID REFERENCES elite_kleingruppen(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_elite_course_times_group_id
  ON elite_course_times(elite_kleingruppe_id);

-- Assign existing course times to the default group
UPDATE elite_course_times
SET elite_kleingruppe_id = (
  SELECT id FROM elite_kleingruppen
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE elite_kleingruppe_id IS NULL;

COMMENT ON COLUMN elite_course_times.elite_kleingruppe_id IS 'References the Elite-Kleingruppe this course time belongs to';

-- =============================================================================
-- Step 4: Make dozent_hours group-specific
-- =============================================================================
ALTER TABLE dozent_hours
  ADD COLUMN IF NOT EXISTS elite_kleingruppe_id UUID REFERENCES elite_kleingruppen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dozent_hours_elite_kleingruppe_id
  ON dozent_hours(elite_kleingruppe_id);

-- Backfill existing Elite-Kleingruppe entries via pending_dozent_hours -> release -> group
UPDATE dozent_hours dh
SET elite_kleingruppe_id = sub.elite_kleingruppe_id
FROM (
  SELECT pdh.dozent_id, pdh.date, pdh.description, r.elite_kleingruppe_id
  FROM pending_dozent_hours pdh
  JOIN elite_kleingruppe_releases r ON r.id = pdh.elite_release_id
  WHERE r.elite_kleingruppe_id IS NOT NULL
) sub
WHERE dh.dozent_id = sub.dozent_id
  AND dh.date = sub.date
  AND dh.description ILIKE '%' || sub.description || '%'
  AND dh.elite_kleingruppe_id IS NULL;

-- For remaining Elite-Kleingruppe category entries without a group, assign default group
UPDATE dozent_hours
SET elite_kleingruppe_id = (
  SELECT id FROM elite_kleingruppen
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE elite_kleingruppe_id IS NULL
  AND (category ILIKE '%elite%' OR description ILIKE '%elite%');

COMMENT ON COLUMN dozent_hours.elite_kleingruppe_id IS 'References the Elite-Kleingruppe for Elite-related activities. NULL for non-Elite activities.';

-- =============================================================================
-- Step 5: Update confirm_pending_hours to carry over elite_kleingruppe_id
-- =============================================================================
CREATE OR REPLACE FUNCTION confirm_pending_hours(pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record RECORD;
  group_id UUID;
BEGIN
  -- Get the pending record with the related release's group id
  SELECT pdh.*, r.elite_kleingruppe_id AS release_group_id
  INTO pending_record
  FROM pending_dozent_hours pdh
  LEFT JOIN elite_kleingruppe_releases r ON r.id = pdh.elite_release_id
  WHERE pdh.id = pending_id
    AND pdh.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending hour entry not found or already processed';
  END IF;

  group_id := pending_record.release_group_id;

  -- Insert into dozent_hours (with group id when available)
  INSERT INTO dozent_hours (
    dozent_id,
    hours,
    date,
    description,
    category,
    elite_kleingruppe_id
  ) VALUES (
    pending_record.dozent_id,
    pending_record.hours,
    pending_record.date,
    pending_record.description,
    pending_record.category,
    group_id
  );

  -- Update status to confirmed
  UPDATE pending_dozent_hours
  SET status = 'confirmed',
      updated_at = NOW()
  WHERE id = pending_id;

  RAISE NOTICE 'Confirmed pending hours: %', pending_id;
END;
$$;

COMMENT ON FUNCTION confirm_pending_hours(UUID) IS 'Confirms a pending hour entry and converts it to dozent_hours (carries over elite_kleingruppe_id from the related release)';
