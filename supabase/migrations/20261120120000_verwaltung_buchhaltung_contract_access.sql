-- Verwaltung & Buchhaltung dürfen den Vertragsbereich vollständig benutzen.
-- is_admin_or_verwaltung() deckt admin, verwaltung und buchhaltung ab.
-- SELECT ist für diese Rollen bereits vorhanden; hier fehlen die Schreibrechte.

-- contracts: INSERT / UPDATE / DELETE
CREATE POLICY "adminverw insert contracts" ON contracts
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw update contracts" ON contracts
  FOR UPDATE TO authenticated
  USING (is_admin_or_verwaltung())
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw delete contracts" ON contracts
  FOR DELETE TO authenticated
  USING (is_admin_or_verwaltung());

-- contract_packages: INSERT / UPDATE / DELETE
CREATE POLICY "adminverw insert contract_packages" ON contract_packages
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw update contract_packages" ON contract_packages
  FOR UPDATE TO authenticated
  USING (is_admin_or_verwaltung())
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw delete contract_packages" ON contract_packages
  FOR DELETE TO authenticated
  USING (is_admin_or_verwaltung());

-- contract_package_legal_areas: INSERT / UPDATE / DELETE
CREATE POLICY "adminverw insert contract_package_legal_areas" ON contract_package_legal_areas
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw update contract_package_legal_areas" ON contract_package_legal_areas
  FOR UPDATE TO authenticated
  USING (is_admin_or_verwaltung())
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw delete contract_package_legal_areas" ON contract_package_legal_areas
  FOR DELETE TO authenticated
  USING (is_admin_or_verwaltung());

-- free_hours: INSERT / UPDATE / DELETE
CREATE POLICY "adminverw insert free_hours" ON free_hours
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw update free_hours" ON free_hours
  FOR UPDATE TO authenticated
  USING (is_admin_or_verwaltung())
  WITH CHECK (is_admin_or_verwaltung());

CREATE POLICY "adminverw delete free_hours" ON free_hours
  FOR DELETE TO authenticated
  USING (is_admin_or_verwaltung());
