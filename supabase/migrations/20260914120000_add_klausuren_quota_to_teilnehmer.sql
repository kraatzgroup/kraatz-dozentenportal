-- Migration: Per-Teilnehmer Klausuren-Kontingent
-- Created: 2026-09-14
-- Adds teilnehmer.klausuren_quota (default 60) and grants 10 extra Klausuren
-- (70 statt 60) to Frederik Pelster and Niklas Mohr in Elite-Kleingruppe 102.

ALTER TABLE teilnehmer
  ADD COLUMN IF NOT EXISTS klausuren_quota integer NOT NULL DEFAULT 60;

COMMENT ON COLUMN teilnehmer.klausuren_quota IS 'Maximales Klausuren-Kontingent des Teilnehmers (Standard: 60)';

-- Elite-Kleingruppe 102: 10 Extra-Klausuren für Frederik Pelster und Niklas Mohr
UPDATE teilnehmer t
SET klausuren_quota = 70
FROM elite_kleingruppen g
WHERE t.elite_kleingruppe_id = g.id
  AND g.group_number = '102'
  AND (
    t.name ILIKE 'Frederik Pelster'
    OR t.name ILIKE 'Niklas Mohr'
    OR (t.first_name ILIKE 'Frederik' AND t.last_name ILIKE 'Pelster')
    OR (t.first_name ILIKE 'Niklas' AND t.last_name ILIKE 'Mohr')
  );
