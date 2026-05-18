-- Migration: Add sort_order to elite_kleingruppe_dozenten
-- Date: 2026-05-18
-- Purpose: Allow admins to define a priority order for multiple dozenten per legal area
--          within the same elite kleingruppe (drag & drop). The first entry (lowest
--          sort_order) becomes the primary recipient for auto-assignment and email
--          notification on klausur upload.

-- 1. Add column (defaults to 0 so existing rows are valid)
ALTER TABLE elite_kleingruppe_dozenten
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Backfill: assign sequential order per (elite_kleingruppe_id, legal_area) based on
--    creation order so the historically-first dozent stays primary.
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY elite_kleingruppe_id, legal_area
      ORDER BY COALESCE(created_at, now())
    ) - 1 AS new_order
  FROM elite_kleingruppe_dozenten
)
UPDATE elite_kleingruppe_dozenten d
SET sort_order = o.new_order
FROM ordered o
WHERE d.id = o.id;

-- 3. Helpful index for ordered lookups in trigger / UI
CREATE INDEX IF NOT EXISTS idx_ekd_group_area_order
  ON elite_kleingruppe_dozenten (elite_kleingruppe_id, legal_area, sort_order);

-- 4. Update auto-assign helper to respect the new order
CREATE OR REPLACE FUNCTION get_dozent_for_legal_area(
  p_elite_kleingruppe_id UUID,
  p_legal_area TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_dozent_id UUID;
BEGIN
  -- Pick the dozent with the lowest sort_order (i.e. the primary one).
  -- created_at is used as a deterministic tie-breaker.
  SELECT dozent_id INTO v_dozent_id
  FROM elite_kleingruppe_dozenten
  WHERE elite_kleingruppe_id = p_elite_kleingruppe_id
    AND legal_area = p_legal_area
  ORDER BY sort_order ASC NULLS LAST, created_at ASC NULLS LAST
  LIMIT 1;

  RETURN v_dozent_id;
END;
$$;

COMMENT ON COLUMN elite_kleingruppe_dozenten.sort_order IS
  'Priority order within (elite_kleingruppe_id, legal_area). 0 = primary dozent who receives auto-assignment and notification emails.';
