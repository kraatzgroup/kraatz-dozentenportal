-- Migration: Backfill zoom_link on existing Einheiten (elite_kleingruppe_releases) for group 102
-- Created: 2026-09-08
-- Purpose: Retroactively attach the correct Zoom join links to the already
--          scheduled Einheiten of Elite-Kleingruppe 102, grouped by legal_area.

DO $$
DECLARE
    group_102_id UUID;
    zivilrecht_zoom text := 'https://us06web.zoom.us/j/9613599764?pwd=ckUyeFJtRDZRVVdvSlVrWURkTkdHZz09';
    oeffentliches_recht_zoom text := 'https://us06web.zoom.us/j/81662451865?pwd=g5D7JMAaoMTzA0V9sT1sF18glK9xQl.1';
    updated_count integer := 0;
BEGIN
    -- Resolve the UUID of the Elite-Kleingruppe with group_number = '102'
    SELECT id INTO group_102_id
    FROM elite_kleingruppen
    WHERE group_number = '102'
    LIMIT 1;

    IF group_102_id IS NULL THEN
        RAISE NOTICE 'No Elite-Kleingruppe with group_number = 102 found. Skipping migration.';
        RETURN;
    END IF;

    -- Zivilrecht: set zoom_link on all existing Einheiten of group 102
    UPDATE elite_kleingruppe_releases
    SET zoom_link = zivilrecht_zoom,
        updated_at = NOW()
    WHERE elite_kleingruppe_id = group_102_id
      AND legal_area = 'Zivilrecht';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % Zivilrecht Einheiten in group 102 with zoom link', updated_count;

    -- Öffentliches Recht: set zoom_link on all existing Einheiten of group 102
    UPDATE elite_kleingruppe_releases
    SET zoom_link = oeffentliches_recht_zoom,
        updated_at = NOW()
    WHERE elite_kleingruppe_id = group_102_id
      AND legal_area = 'Öffentliches Recht';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % Öffentliches Recht Einheiten in group 102 with zoom link', updated_count;

    RAISE NOTICE 'Zoom link backfill for group 102 completed successfully';
END $$;
