-- Migration: Enable Realtime for elite_kleingruppe_releases table
-- Created: 2026-03-07
-- Description: Enable Supabase Realtime for the elite_kleingruppe_releases table
-- so that participants see changes immediately when units are created, updated, or deleted.

-- Enable Realtime for the elite_kleingruppe_releases table
alter publication supabase_realtime add table elite_kleingruppe_releases;

-- Comment explaining the change
COMMENT ON TABLE elite_kleingruppe_releases IS 'Manages releases for Elite-Kleingruppe. Realtime enabled for live updates.';
