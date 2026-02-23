-- Migration: Erweitere Elite-Kleingruppe Kalender um Enddatum für Zeitspannen
-- Datum: 2025-02-23
-- Beschreibung: Ermöglicht das Eintragen von Zeitspannen (z.B. Ferien vom 13.03. - 20.03.)

-- 1. Füge end_date Spalte hinzu
ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- 2. Kommentar zur Dokumentation
COMMENT ON COLUMN elite_kleingruppe_releases.end_date IS 'Enddatum für Zeitspannen-Events (z.B. Ferienzeiten). Wenn NULL, ist es ein einzelner Tag (release_date).';

-- 3. Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_elite_releases_end_date ON elite_kleingruppe_releases(end_date);
