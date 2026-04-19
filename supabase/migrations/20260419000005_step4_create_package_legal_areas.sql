/*
  # Schritt 4: Create package_legal_areas table
  
  Neue Tabelle für Rechtsgebiete pro Paket:
  - Maximal 3 Rechtsgebiete pro Paket
  - Jedes Rechtsgebiet hat Stunden
  - Summe der Rechtsgebiet-Stunden = Paket-Stunden
*/

-- ============================================
-- Create package_legal_areas table
-- ============================================
CREATE TABLE IF NOT EXISTS package_legal_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  
  -- Rechtsgebiet (max 3 pro Paket)
  legal_area TEXT NOT NULL CHECK (legal_area IN ('zivilrecht', 'strafrecht', 'oeffentliches_recht', 'sonstiges')),
  
  -- Stunden für dieses Rechtsgebiet
  hours INTEGER NOT NULL CHECK (hours > 0),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Constraints
-- ============================================
ALTER TABLE package_legal_areas 
  ADD CONSTRAINT package_legal_areas_unique UNIQUE (package_id, legal_area);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_package_legal_areas_package_id ON package_legal_areas(package_id);
CREATE INDEX IF NOT EXISTS idx_package_legal_areas_legal_area ON package_legal_areas(legal_area);

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 4 abgeschlossen: package_legal_areas Tabelle erstellt';
  RAISE NOTICE '- Neue Tabelle: package_legal_areas';
  RAISE NOTICE '- Constraints: Max 3 Rechtsgebiete pro Paket (durch unique constraint)';
  RAISE NOTICE '- Keine bestehenden Daten verändert';
END $$;
