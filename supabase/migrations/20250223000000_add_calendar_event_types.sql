-- Migration: Erweitere Elite-Kleingruppe Kalender um zusätzliche Event-Typen
-- Datum: 2025-02-23
-- Beschreibung: Ermöglicht das Eintragen von Ferienzeiten und Dozentenverhinderungen

-- 1. Füge event_type Spalte hinzu
ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'einheit' CHECK (event_type IN (
  'einheit',
  'ferien',
  'dozent_verhinderung',
  'sonstiges'
));

-- 2. Kommentar zur Dokumentation
COMMENT ON COLUMN elite_kleingruppe_releases.event_type IS 'Typ des Kalendereintrags:
- einheit: Reguläre Unterrichts- oder Wiederholungseinheit (Standard)
- ferien: Ferienzeiten (keine Einheiten)
- dozent_verhinderung: Dozent verhindert (Einheit fällt aus)
- sonstiges: Andere Kalendereinträge';

-- 3. unit_type ist jetzt optional (NULL erlaubt für Nicht-Einheiten)
ALTER TABLE elite_kleingruppe_releases 
ALTER COLUMN unit_type DROP NOT NULL;

-- 4. Index für schnellere Event-Type Abfragen
CREATE INDEX IF NOT EXISTS idx_elite_releases_event_type ON elite_kleingruppe_releases(event_type);
