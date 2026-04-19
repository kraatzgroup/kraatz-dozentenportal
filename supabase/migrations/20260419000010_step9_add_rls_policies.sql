/*
  # Schritt 9: RLS Policies hinzufügen
  
  RLS Policies für neue Tabellen:
  - contracts: Dozenten können Verträge ihrer Teilnehmer sehen, Admins alle
  - contract_packages: Admin-only (vorerst)
  - package_legal_areas: Admin-only (vorerst)
  - free_hours: Admin-only (vorerst)
*/

-- ============================================
-- Enable RLS on contracts
-- ============================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Dozenten can view contracts of their teilnehmer
CREATE POLICY "Dozenten can view contracts of their teilnehmer" ON contracts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teilnehmer 
      WHERE id = contracts.teilnehmer_id 
      AND dozent_id = auth.uid()
    )
  );

-- Admins can view all contracts
CREATE POLICY "Admins can view all contracts" ON contracts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can create contracts
CREATE POLICY "Admins can create contracts" ON contracts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can update contracts
CREATE POLICY "Admins can update contracts" ON contracts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can delete contracts
CREATE POLICY "Admins can delete contracts" ON contracts
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- Enable RLS on contract_packages
-- ============================================
ALTER TABLE contract_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract_packages" ON contract_packages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- Enable RLS on package_legal_areas
-- ============================================
ALTER TABLE package_legal_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage package_legal_areas" ON package_legal_areas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- Enable RLS on free_hours
-- ============================================
ALTER TABLE free_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage free_hours" ON free_hours
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 9 abgeschlossen: RLS Policies hinzugefügt';
  RAISE NOTICE '- contracts: Dozenten können Verträge ihrer Teilnehmer sehen, Admins alle';
  RAISE NOTICE '- contract_packages: Admin-only (vorerst)';
  RAISE NOTICE '- package_legal_areas: Admin-only (vorerst)';
  RAISE NOTICE '- free_hours: Admin-only (vorerst)';
END $$;
