-- Migration: Elite-Kleingruppe Einheitstypen, Zoom-Links und Lösungs-Freigabe
-- Datum: 2025-01-28

-- 1. Zoom-Link für Dozenten in der Elite-Kleingruppe
ALTER TABLE elite_kleingruppe_dozenten 
ADD COLUMN IF NOT EXISTS zoom_link TEXT;

-- 2. Erweitere elite_kleingruppe_releases um neue Felder
ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS unit_type TEXT CHECK (unit_type IN (
  'unterricht_zivilrecht',
  'unterricht_strafrecht', 
  'unterricht_oeffentliches_recht',
  'wiederholung_zivilrecht',
  'wiederholung_strafrecht',
  'wiederholung_oeffentliches_recht'
));

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS zoom_link TEXT;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS klausur_folder_id UUID REFERENCES material_folders(id);

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS solution_material_ids UUID[] DEFAULT '{}';

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS solutions_released BOOLEAN DEFAULT false;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('weekly', 'monthly'));

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS recurrence_count INTEGER;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS parent_release_id UUID REFERENCES elite_kleingruppe_releases(id);

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS dozent_id UUID REFERENCES profiles(id);

-- 3. Funktion zum automatischen Freigeben von Lösungen nach Termin-Ende
CREATE OR REPLACE FUNCTION release_solutions_after_meeting()
RETURNS TRIGGER AS $$
BEGIN
  -- Wenn der Termin vorbei ist und Lösungen noch nicht freigegeben
  IF NEW.release_date < CURRENT_DATE 
     OR (NEW.release_date = CURRENT_DATE AND NEW.end_time IS NOT NULL AND NEW.end_time < CURRENT_TIME)
  THEN
    NEW.solutions_released := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für automatische Lösungsfreigabe
DROP TRIGGER IF EXISTS trigger_release_solutions ON elite_kleingruppe_releases;
CREATE TRIGGER trigger_release_solutions
  BEFORE UPDATE ON elite_kleingruppe_releases
  FOR EACH ROW
  EXECUTE FUNCTION release_solutions_after_meeting();

-- 4. Policy für Dozenten: Können Einheiten für ihre Rechtsgebiete erstellen
DROP POLICY IF EXISTS "Dozenten can create releases for their legal areas" ON elite_kleingruppe_releases;
CREATE POLICY "Dozenten can create releases for their legal areas"
  ON elite_kleingruppe_releases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM elite_kleingruppe_dozenten
      WHERE elite_kleingruppe_dozenten.dozent_id = auth.uid()
      AND elite_kleingruppe_dozenten.legal_area = elite_kleingruppe_releases.legal_area
    )
  );

DROP POLICY IF EXISTS "Dozenten can update their releases" ON elite_kleingruppe_releases;
CREATE POLICY "Dozenten can update their releases"
  ON elite_kleingruppe_releases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR
    dozent_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM elite_kleingruppe_dozenten
      WHERE elite_kleingruppe_dozenten.dozent_id = auth.uid()
      AND elite_kleingruppe_dozenten.legal_area = elite_kleingruppe_releases.legal_area
    )
  );

-- 5. Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_elite_releases_unit_type ON elite_kleingruppe_releases(unit_type);
CREATE INDEX IF NOT EXISTS idx_elite_releases_dozent ON elite_kleingruppe_releases(dozent_id);
CREATE INDEX IF NOT EXISTS idx_elite_releases_parent ON elite_kleingruppe_releases(parent_release_id);

-- 6. Kommentar zur Dokumentation der Einheitstypen und Dauern
COMMENT ON COLUMN elite_kleingruppe_releases.unit_type IS 'Typ der Einheit mit automatischer Dauer:
- unterricht_zivilrecht: 2,5 Stunden (150 Min)
- unterricht_strafrecht: 2 Stunden (120 Min)
- unterricht_oeffentliches_recht: 2 Stunden (120 Min)
- wiederholung_zivilrecht: 2,5 Stunden (150 Min)
- wiederholung_strafrecht: 1 Stunde 40 Min (100 Min)
- wiederholung_oeffentliches_recht: 1 Stunde 10 Min (70 Min)';
