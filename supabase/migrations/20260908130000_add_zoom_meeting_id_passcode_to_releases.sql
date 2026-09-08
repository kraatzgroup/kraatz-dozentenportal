-- Migration: Add zoom_meeting_id and zoom_passcode to elite_kleingruppe_releases
-- Created: 2026-09-08
-- Purpose: Store Meeting ID and Passcode per Einheit alongside the zoom_link,
--          so participants see all three fields per unit (not only in the group settings).

ALTER TABLE elite_kleingruppe_releases
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
ALTER TABLE elite_kleingruppe_releases
  ADD COLUMN IF NOT EXISTS zoom_passcode TEXT;

COMMENT ON COLUMN elite_kleingruppe_releases.zoom_meeting_id IS 'Zoom Meeting ID for this Einheit (optional, auto-filled from group zoom_links settings)';
COMMENT ON COLUMN elite_kleingruppe_releases.zoom_passcode IS 'Zoom passcode for this Einheit (optional, auto-filled from group zoom_links settings)';

-- Backfill existing Einheiten from the group zoom_links settings (per legal_area)
DO $$
DECLARE
    zoom_links_setting jsonb;
    rec record;
BEGIN
    -- Iterate over all per-group zoom_links settings
    FOR rec IN
        SELECT elite_kleingruppe_id, setting_value
        FROM elite_kleingruppe_settings
        WHERE setting_key = 'zoom_links'
          AND elite_kleingruppe_id IS NOT NULL
    LOOP
        zoom_links_setting := rec.setting_value;

        -- Zivilrecht
        IF zoom_links_setting->'Zivilrecht'->>'url' IS NOT NULL THEN
            UPDATE elite_kleingruppe_releases
            SET zoom_meeting_id = zoom_links_setting->'Zivilrecht'->>'meetingId',
                zoom_passcode = zoom_links_setting->'Zivilrecht'->>'passcode'
            WHERE elite_kleingruppe_id = rec.elite_kleingruppe_id
              AND legal_area = 'Zivilrecht'
              AND (zoom_meeting_id IS NULL OR zoom_meeting_id = '')
              AND (zoom_passcode IS NULL OR zoom_passcode = '');
        END IF;

        -- Strafrecht
        IF zoom_links_setting->'Strafrecht'->>'url' IS NOT NULL THEN
            UPDATE elite_kleingruppe_releases
            SET zoom_meeting_id = zoom_links_setting->'Strafrecht'->>'meetingId',
                zoom_passcode = zoom_links_setting->'Strafrecht'->>'passcode'
            WHERE elite_kleingruppe_id = rec.elite_kleingruppe_id
              AND legal_area = 'Strafrecht'
              AND (zoom_meeting_id IS NULL OR zoom_meeting_id = '')
              AND (zoom_passcode IS NULL OR zoom_passcode = '');
        END IF;

        -- Öffentliches Recht
        IF zoom_links_setting->'Öffentliches Recht'->>'url' IS NOT NULL THEN
            UPDATE elite_kleingruppe_releases
            SET zoom_meeting_id = zoom_links_setting->'Öffentliches Recht'->>'meetingId',
                zoom_passcode = zoom_links_setting->'Öffentliches Recht'->>'passcode'
            WHERE elite_kleingruppe_id = rec.elite_kleingruppe_id
              AND legal_area = 'Öffentliches Recht'
              AND (zoom_meeting_id IS NULL OR zoom_meeting_id = '')
              AND (zoom_passcode IS NULL OR zoom_passcode = '');
        END IF;
    END LOOP;

    RAISE NOTICE 'Backfill of zoom_meeting_id / zoom_passcode completed';
END $$;
