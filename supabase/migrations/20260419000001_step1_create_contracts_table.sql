/*
  # Schritt 1: Create contracts table
  
  Neue Tabelle für Verträge mit:
  - Vertragsnummer basierend auf Teilnehmernummer (TNXXXX für 1., TNXXXX_1 für 2., etc.)
  - Laufzeit (start_date, end_date)
  - Stunden (total_hours, calculated_hours, free_hours_total)
  - Status (draft, active, paused, cancelled, expired, completed)
*/

-- ============================================
-- Create contracts table
-- ============================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,
  teilnehmer_id UUID NOT NULL REFERENCES teilnehmer(id) ON DELETE CASCADE,
  
  -- Laufzeit
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Stunden (werden automatisch berechnet)
  total_hours INTEGER DEFAULT 0,
  calculated_hours INTEGER DEFAULT 0,
  free_hours_total INTEGER DEFAULT 0,
  
  -- Status
  status TEXT CHECK (status IN ('draft', 'active', 'paused', 'cancelled', 'expired', 'completed')) DEFAULT 'draft',
  
  -- Notizen
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- ============================================
-- Constraints
-- ============================================
ALTER TABLE contracts 
  ADD CONSTRAINT contracts_hours_valid CHECK (total_hours >= 0),
  ADD CONSTRAINT contracts_dates_valid CHECK (end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT contracts_number_format CHECK (contract_number ~ '^TN[0-9]{4,5}(_[0-9]+)?$');

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contracts_teilnehmer_id ON contracts(teilnehmer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(start_date, end_date);

-- ============================================
-- Add current_contract_id to teilnehmer (optional reference)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teilnehmer' AND column_name = 'current_contract_id') THEN
    ALTER TABLE teilnehmer ADD COLUMN current_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_teilnehmer_current_contract_id ON teilnehmer(current_contract_id);
    COMMENT ON COLUMN teilnehmer.current_contract_id IS 'Reference to current active contract (optional, for quick access)';
  END IF;
END $$;

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 1 abgeschlossen: contracts Tabelle erstellt';
  RAISE NOTICE '- Neue Tabelle: contracts';
  RAISE NOTICE '- Feld hinzugefügt: teilnehmer.current_contract_id';
  RAISE NOTICE '- Keine bestehenden Daten gelöscht oder verändert';
END $$;
