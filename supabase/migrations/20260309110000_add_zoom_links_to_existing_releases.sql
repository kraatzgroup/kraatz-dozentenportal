-- Migration: Add Zoom links retroactively to existing elite_kleingruppe_releases
-- Based on the legal_area and the zoom_links settings

-- Create a temporary function to update zoom links
DO $$
DECLARE
    zoom_links_setting jsonb;
    zivilrecht_zoom text;
    strafrecht_zoom text;
    oeffentliches_recht_zoom text;
    updated_count integer := 0;
    release_record record;
BEGIN
    -- Get zoom_links from settings
    SELECT setting_value INTO zoom_links_setting
    FROM elite_kleingruppe_settings
    WHERE setting_key = 'zoom_links';

    -- If no settings found, exit
    IF zoom_links_setting IS NULL THEN
        RAISE NOTICE 'No zoom_links settings found. Skipping migration.';
        RETURN;
    END IF;

    -- Extract zoom URLs for each legal area
    zivilrecht_zoom := zoom_links_setting->'Zivilrecht'->>'url';
    strafrecht_zoom := zoom_links_setting->'Strafrecht'->>'url';
    oeffentliches_recht_zoom := zoom_links_setting->'Öffentliches Recht'->>'url';

    RAISE NOTICE 'Found zoom links - Zivilrecht: %, Strafrecht: %, Oeffentliches Recht: %',
        COALESCE(zivilrecht_zoom, 'not set'),
        COALESCE(strafrecht_zoom, 'not set'),
        COALESCE(oeffentliches_recht_zoom, 'not set');

    -- Update releases with Zivilrecht
    IF zivilrecht_zoom IS NOT NULL AND zivilrecht_zoom != '' THEN
        UPDATE elite_kleingruppe_releases
        SET zoom_link = zivilrecht_zoom,
            updated_at = NOW()
        WHERE legal_area = 'Zivilrecht'
          AND (zoom_link IS NULL OR zoom_link = '');

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % Zivilrecht releases with zoom link', updated_count;
    END IF;

    -- Update releases with Strafrecht
    IF strafrecht_zoom IS NOT NULL AND strafrecht_zoom != '' THEN
        UPDATE elite_kleingruppe_releases
        SET zoom_link = strafrecht_zoom,
            updated_at = NOW()
        WHERE legal_area = 'Strafrecht'
          AND (zoom_link IS NULL OR zoom_link = '');

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % Strafrecht releases with zoom link', updated_count;
    END IF;

    -- Update releases with Öffentliches Recht
    IF oeffentliches_recht_zoom IS NOT NULL AND oeffentliches_recht_zoom != '' THEN
        UPDATE elite_kleingruppe_releases
        SET zoom_link = oeffentliches_recht_zoom,
            updated_at = NOW()
        WHERE legal_area = 'Öffentliches Recht'
          AND (zoom_link IS NULL OR zoom_link = '');

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % Oeffentliches Recht releases with zoom link', updated_count;
    END IF;

    RAISE NOTICE 'Zoom links migration completed successfully';
END $$;
