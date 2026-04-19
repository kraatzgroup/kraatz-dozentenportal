/*
  # Schritt 8: Trigger für automatische Stundenberechnung
  
  Trigger:
  - update_contract_total_hours: Aktualisiert Vertragsstunden bei Änderungen an contract_packages oder free_hours
*/

-- ============================================
-- Funktion: Gesamtstunden für Vertrag aktualisieren
-- ============================================
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

-- ============================================
-- Trigger: Stunden bei contract_packages Änderungen aktualisieren
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_contract_hours_after_package ON contract_packages;
CREATE TRIGGER trigger_update_contract_hours_after_package
  AFTER INSERT OR UPDATE OR DELETE ON contract_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_total_hours();

-- ============================================
-- Trigger: Stunden bei free_hours Änderungen aktualisieren
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_contract_hours_after_free_hours ON free_hours;
CREATE TRIGGER trigger_update_contract_hours_after_free_hours
  AFTER INSERT OR UPDATE OR DELETE ON free_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_total_hours();

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 8 abgeschlossen: Trigger für automatische Stundenberechnung erstellt';
  RAISE NOTICE '- update_contract_total_hours: Aktualisiert Vertragsstunden bei Änderungen';
  RAISE NOTICE '- trigger_update_contract_hours_after_package: Trigger für contract_packages';
  RAISE NOTICE '- trigger_update_contract_hours_after_free_hours: Trigger für free_hours';
END $$;
