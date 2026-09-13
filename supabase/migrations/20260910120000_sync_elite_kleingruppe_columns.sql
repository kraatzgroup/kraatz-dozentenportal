-- Migration: Sync elite_kleingruppe (legacy) and is_elite_kleingruppe (current) columns
-- Created: 2026-09-10
--
-- Root cause: Migration 20260301 added is_elite_kleingruppe as the canonical column and
-- backfilled it from the legacy elite_kleingruppe column for existing rows. However, the
-- legacy column was never dropped, and new teilnehmer created via UserManagement only set
-- is_elite_kleingruppe. EliteKleingruppe.tsx filtered on the legacy column, so newly
-- created elite teilnehmer (e.g. group 102) were excluded from the Teilnehmer tab.
--
-- This migration backfills the legacy column from the canonical one and adds a trigger
-- to keep them in sync going forward, so any code still reading the legacy column keeps
-- working until it is migrated.

-- Step 1: Backfill legacy elite_kleingruppe from is_elite_kleingruppe
UPDATE teilnehmer
SET elite_kleingruppe = is_elite_kleingruppe
WHERE elite_kleingruppe IS DISTINCT FROM is_elite_kleingruppe;

-- Step 2: Add trigger to keep elite_kleingruppe in sync with is_elite_kleingruppe
CREATE OR REPLACE FUNCTION sync_elite_kleingruppe_columns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.elite_kleingruppe := NEW.is_elite_kleingruppe;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_elite_kleingruppe_columns ON teilnehmer;
CREATE TRIGGER trg_sync_elite_kleingruppe_columns
  BEFORE INSERT OR UPDATE OF is_elite_kleingruppe ON teilnehmer
  FOR EACH ROW
  EXECUTE FUNCTION sync_elite_kleingruppe_columns();
