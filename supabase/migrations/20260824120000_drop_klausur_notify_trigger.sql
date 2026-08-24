-- Migration: Replace trigger-based klausur-notify with frontend-based call
-- Date: 2026-08-24
-- Purpose: The notify_dozent_of_klausur() trigger called the klausur-notify
-- edge function via pg_net WITHOUT an Authorization header. Supabase's edge
-- function gateway rejects such requests with 401 before the function runs,
-- so no dozent notification email was ever sent and no edge function logs
-- were produced. The trigger's EXCEPTION handler swallowed the error
-- silently (only a RAISE WARNING in the Postgres logs).
--
-- The team previously moved away from trigger-based edge function calls for
-- exactly this reason (see 20250629183958_tight_wave.sql which removed the
-- message/upload notification triggers because they were "complex and
-- error-prone"). The klausur-notify trigger was added later (2026-03-10)
-- with the same fragile pattern.
--
-- This migration drops the broken trigger and function. The dozent
-- notification is now called directly from the frontend after the klausur
-- insert succeeds, using supabase.functions.invoke — the same reliable
-- pattern used by the VB case study submission flow
-- (vb-notify-dozent-submission).
--
-- The auto_assign_klausur_dozent BEFORE INSERT trigger is KEPT because it
-- still usefully sets dozent_id on insert; the frontend reads that value
-- back to determine which dozent to notify.

-- Drop the broken notification trigger
DROP TRIGGER IF EXISTS trigger_notify_dozent_of_klausur ON elite_kleingruppe_klausuren;

-- Drop the function (no longer needed — notification is frontend-driven)
DROP FUNCTION IF EXISTS notify_dozent_of_klausur();
