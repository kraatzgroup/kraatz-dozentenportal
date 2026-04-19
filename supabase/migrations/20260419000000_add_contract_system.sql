/*
  # Add Contract System for Participants
  
  This migration adds a comprehensive contract system while preserving all existing data.
  No existing tables or data will be deleted or modified.
  
  New Tables:
  - contracts: Main contract table with participant-based contract numbers
  - contract_packages: Junction table for contract-package relationships
  - package_legal_areas: Legal areas distribution within packages
  - free_hours: Free hours assigned to contracts
  
  Legacy Fields (preserved):
  - teilnehmer.package_id: Kept for backward compatibility
  - teilnehmer.hours_zivilrecht: Kept for backward compatibility
  - teilnehmer.hours_strafrecht: Kept for backward compatibility
  - teilnehmer.hours_oeffentliches_recht: Kept for backward compatibility
  - teilnehmer_pakete: Kept (currently empty, 0 records)
  - pakete: Kept (5 records, used by upsells)
*/

-- ============================================
-- 1. Create contracts table
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

-- Constraints
ALTER TABLE contracts 
  ADD CONSTRAINT contracts_hours_valid CHECK (total_hours >= 0),
  ADD CONSTRAINT contracts_dates_valid CHECK (end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT contracts_number_format CHECK (contract_number ~ '^TN[0-9]{4,5}(_[0-9]+)?$');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_teilnehmer_id ON contracts(teilnehmer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(start_date, end_date);

-- ============================================
-- 2. Create contract_packages junction table
-- ============================================
CREATE TABLE IF NOT EXISTS contract_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  
  -- Stunden für dieses Paket im Vertrag
  hours INTEGER NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
ALTER TABLE contract_packages 
  ADD CONSTRAINT contract_packages_hours_positive CHECK (hours > 0),
  ADD CONSTRAINT contract_packages_unique UNIQUE (contract_id, package_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_packages_contract_id ON contract_packages(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_packages_package_id ON contract_packages(package_id);

-- ============================================
-- 3. Create package_legal_areas table
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

-- Constraints
ALTER TABLE package_legal_areas 
  ADD CONSTRAINT package_legal_areas_unique UNIQUE (package_id, legal_area);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_package_legal_areas_package_id ON package_legal_areas(package_id);
CREATE INDEX IF NOT EXISTS idx_package_legal_areas_legal_area ON package_legal_areas(legal_area);

-- ============================================
-- 4. Create free_hours table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_free_hours_contract_id ON free_hours(contract_id);

-- ============================================
-- 5. Add current_contract_id to teilnehmer (optional)
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
-- 6. Functions for contract numbers
-- ============================================
CREATE OR REPLACE FUNCTION generate_contract_number(p_teilnehmer_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_tn_nummer TEXT;
  v_contract_count INTEGER;
  v_contract_number TEXT;
BEGIN
  -- Teilnehmernummer holen
  SELECT tn_nummer INTO v_tn_nummer
  FROM teilnehmer
  WHERE id = p_teilnehmer_id;
  
  IF v_tn_nummer IS NULL THEN
    RAISE EXCEPTION 'Teilnehmer hat keine Teilnehmernummer';
  END IF;
  
  -- Anzahl existierender Verträge für diesen Teilnehmer zählen
  SELECT COUNT(*) INTO v_contract_count
  FROM contracts
  WHERE teilnehmer_id = p_teilnehmer_id;
  
  -- Erster Vertrag = TNXXXX, weitere = TNXXXX_1, TNXXXX_2, etc.
  IF v_contract_count = 0 THEN
    v_contract_number := v_tn_nummer;
  ELSE
    v_contract_number := v_tn_nummer || '_' || (v_contract_count)::TEXT;
  END IF;
  
  RETURN v_contract_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Vertragsnummer automatisch setzen
CREATE OR REPLACE FUNCTION set_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    NEW.contract_number := generate_contract_number(NEW.teilnehmer_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_contract_number ON contracts;
CREATE TRIGGER trigger_set_contract_number
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_contract_number();

-- ============================================
-- 7. Functions for automatic hour calculation
-- ============================================
CREATE OR REPLACE FUNCTION calculate_package_hours(p_package_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_hours INTEGER;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
  FROM package_legal_areas
  WHERE package_id = p_package_id;
  
  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_contract_hours_from_packages(p_contract_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_hours INTEGER;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
  FROM contract_packages
  WHERE contract_id = p_contract_id;
  
  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_contract_free_hours(p_contract_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_hours INTEGER;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
  FROM free_hours
  WHERE contract_id = p_contract_id;
  
  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_contract_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contracts
  SET 
    calculated_hours = calculate_contract_hours_from_packages(NEW.contract_id),
    free_hours_total = calculate_contract_free_hours(NEW.contract_id),
    total_hours = calculate_contract_hours_from_packages(NEW.contract_id) + calculate_contract_free_hours(NEW.contract_id),
    updated_at = NOW()
  WHERE id = NEW.contract_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Stunden bei Änderungen aktualisieren
DROP TRIGGER IF EXISTS trigger_update_contract_hours_after_package ON contract_packages;
CREATE TRIGGER trigger_update_contract_hours_after_package
  AFTER INSERT OR UPDATE OR DELETE ON contract_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_total_hours();

DROP TRIGGER IF EXISTS trigger_update_contract_hours_after_free_hours ON free_hours;
CREATE TRIGGER trigger_update_contract_hours_after_free_hours
  AFTER INSERT OR UPDATE OR DELETE ON free_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_total_hours();

-- ============================================
-- 8. Views for overview
-- ============================================
CREATE OR REPLACE VIEW teilnehmer_contracts_overview AS
SELECT 
  t.id AS teilnehmer_id,
  t.tn_nummer,
  t.name AS teilnehmer_name,
  t.email,
  c.id AS contract_id,
  c.contract_number,
  c.start_date,
  c.end_date,
  c.status AS contract_status,
  c.total_hours,
  c.free_hours_total,
  c.calculated_hours,
  COUNT(DISTINCT cp.id) AS package_count,
  COUNT(DISTINCT fh.id) AS free_hours_count
FROM teilnehmer t
LEFT JOIN contracts c ON t.id = c.teilnehmer_id
LEFT JOIN contract_packages cp ON c.id = cp.contract_id
LEFT JOIN free_hours fh ON c.id = fh.contract_id
GROUP BY t.id, t.tn_nummer, t.name, t.email, c.id, c.contract_number, c.start_date, c.end_date, c.status, c.total_hours, c.free_hours_total, c.calculated_hours;

CREATE OR REPLACE VIEW packages_with_legal_areas AS
SELECT 
  p.id AS package_id,
  p.name AS package_name,
  p.hours AS base_hours,
  COALESCE(SUM(pla.hours), 0) AS calculated_hours,
  COUNT(DISTINCT pla.id) AS legal_area_count,
  array_agg(DISTINCT pla.legal_area ORDER BY pla.legal_area) FILTER (WHERE pla.legal_area IS NOT NULL) AS legal_areas,
  array_agg(pla.hours ORDER BY pla.legal_area) FILTER (WHERE pla.hours IS NOT NULL) AS legal_area_hours
FROM packages p
LEFT JOIN package_legal_areas pla ON p.id = pla.package_id
GROUP BY p.id, p.name, p.hours;

-- ============================================
-- 9. RLS Policies
-- ============================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dozenten can view contracts of their teilnehmer" ON contracts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teilnehmer 
      WHERE id = contracts.teilnehmer_id 
      AND dozent_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all contracts" ON contracts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can create contracts" ON contracts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update contracts" ON contracts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete contracts" ON contracts
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Enable RLS for other tables
ALTER TABLE contract_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_legal_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_hours ENABLE ROW LEVEL SECURITY;

-- Similar policies for other tables (admin-only for now)
CREATE POLICY "Admins can manage contract_packages" ON contract_packages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage package_legal_areas" ON package_legal_areas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage free_hours" ON free_hours
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Grant access to views
GRANT SELECT ON teilnehmer_contracts_overview TO authenticated;
GRANT SELECT ON packages_with_legal_areas TO authenticated;

-- ============================================
-- 10. Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Contract system migration completed successfully';
  RAISE NOTICE '- No existing data was deleted or modified';
  RAISE NOTICE '- Legacy fields in teilnehmer preserved (package_id, hours_zivilrecht, hours_strafrecht, hours_oeffentliches_recht)';
  RAISE NOTICE '- Legacy tables preserved (teilnehmer_pakete, pakete)';
  RAISE NOTICE '- New tables: contracts, contract_packages, package_legal_areas, free_hours';
  RAISE NOTICE '- New functions: generate_contract_number, calculate_package_hours, calculate_contract_hours_from_packages, calculate_contract_free_hours';
  RAISE NOTICE '- New views: teilnehmer_contracts_overview, packages_with_legal_areas';
END $$;
