/*
  # Schritt 6: Create free_hours table
  
  Neue Tabelle für Freistunden:
  - Werden einem Vertrag zugewiesen
  - Haben eine Anzahl und eine Begründung
  - Werden zur Gesamtstundenzahl des Vertrags addiert
*/

-- ============================================
-- Create free_hours table
-- ============================================
CREATE TABLE IF NOT EXISTS free_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  
  -- Freistunden
  hours INTEGER NOT NULL CHECK (hours > 0),
  reason TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_free_hours_contract_id ON free_hours(contract_id);

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 6 abgeschlossen: free_hours Tabelle erstellt';
  RAISE NOTICE '- Neue Tabelle: free_hours';
  RAISE NOTICE '- Freistunden werden Verträgen zugewiesen';
  RAISE NOTICE '- Werden zur Vertragsstundenzahl addiert';
  RAISE NOTICE '- Keine bestehenden Daten verändert';
END $$;
