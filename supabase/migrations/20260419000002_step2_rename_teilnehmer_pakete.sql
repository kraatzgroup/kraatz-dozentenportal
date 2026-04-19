/*
  # Schritt 2: Rename teilnehmer_pakete to contract_packages and extend
  
  teilnehmer_pakete hat 0 Einträge, kann sicher umbenannt werden.
  Erweiterung: contract_id statt direktem teilnehmer_id Bezug für bessere Struktur.
*/

-- ============================================
-- Rename table
-- ============================================
ALTER TABLE teilnehmer_pakete RENAME TO contract_packages;

-- ============================================
-- Add contract_id column (nullable initially for backward compatibility)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_packages' AND column_name = 'contract_id') THEN
    ALTER TABLE contract_packages ADD COLUMN contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_contract_packages_contract_id ON contract_packages(contract_id);
    COMMENT ON COLUMN contract_packages.contract_id IS 'Reference to contract (replaces direct teilnehmer_id for better structure)';
  END IF;
END $$;

-- ============================================
-- Update foreign key from pakete to packages
-- ============================================
-- First, drop the existing foreign key constraint
DO $$
BEGIN
  -- Drop the foreign key constraint to pakete
  ALTER TABLE contract_packages DROP CONSTRAINT IF EXISTS contract_packages_paket_id_fkey;
  
  -- Add new foreign key constraint to packages
  ALTER TABLE contract_packages 
    ADD CONSTRAINT contract_packages_package_id_fkey 
    FOREIGN KEY (paket_id) REFERENCES packages(id) ON DELETE SET NULL;
  
  -- Rename paket_id to package_id for consistency
  ALTER TABLE contract_packages RENAME COLUMN paket_id TO package_id;
END $$;

-- ============================================
-- Update indexes for new structure
-- ============================================
DROP INDEX IF EXISTS idx_contract_packages_package_id;
CREATE INDEX IF NOT EXISTS idx_contract_packages_package_id ON contract_packages(package_id);

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 2 abgeschlossen: teilnehmer_pakete zu contract_packages umbenannt';
  RAISE NOTICE '- Tabelle umbenannt: teilnehmer_pakete → contract_packages';
  RAISE NOTICE '- Feld hinzugefügt: contract_id';
  RAISE NOTICE '- Foreign Key aktualisiert: pakete → packages';
  RAISE NOTICE '- Spalte umbenannt: paket_id → package_id';
  RAISE NOTICE '- Keine Daten verloren (0 Einträge in ursprünglicher Tabelle)';
END $$;
