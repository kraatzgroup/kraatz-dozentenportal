/*
  # Schritt 7: Funktionen für Vertragsnummern und Stundenberechnung
  
  Funktionen:
  - generate_contract_number: Vertragsnummer basierend auf Teilnehmernummer
  - calculate_package_hours: Paket-Stunden aus Rechtsgebieten berechnen
  - calculate_contract_hours_from_packages: Vertrags-Stunden aus Paketen berechnen
  - calculate_contract_free_hours: Freistunden für Vertrag berechnen
*/

-- ============================================
-- Funktion: Vertragsnummer für neuen Vertrag generieren
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

-- ============================================
-- Trigger: Vertragsnummer automatisch setzen
-- ============================================
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
-- Funktion: Paket-Stunden aus Rechtsgebieten berechnen
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

-- ============================================
-- Funktion: Vertrags-Stunden aus Paketen berechnen
-- ============================================
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

-- ============================================
-- Funktion: Freistunden für Vertrag berechnen
-- ============================================
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

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 7 abgeschlossen: Funktionen erstellt';
  RAISE NOTICE '- generate_contract_number: Vertragsnummer basierend auf Teilnehmernummer';
  RAISE NOTICE '- set_contract_number: Trigger für automatische Vertragsnummer';
  RAISE NOTICE '- calculate_package_hours: Paket-Stunden aus Rechtsgebieten';
  RAISE NOTICE '- calculate_contract_hours_from_packages: Vertrags-Stunden aus Paketen';
  RAISE NOTICE '- calculate_contract_free_hours: Freistunden für Vertrag';
END $$;
