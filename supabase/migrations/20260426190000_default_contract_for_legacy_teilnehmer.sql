/*
  # Default-Vertrag + Paket 1 für Teilnehmer ohne Verträge
  
  Ziel:
  - Backfill: Teilnehmer mit participant_hours aber ohne contracts bekommen
    einen Default-Vertrag (Vertragsnummer = tn_nummer) und ein Paket 1.
    Paket-Rechtsgebietsstunden kommen aus den Legacy-Feldern
    hours_zivilrecht / hours_strafrecht / hours_oeffentliches_recht.
  - Zukünftig: Trigger auf participant_hours INSERT erstellt automatisch
    einen Default-Vertrag, falls keiner existiert.
  
  Sicherstellen: Bestehende participant_hours bekommen nach Backfill die neue
  contract_id + package_id zugewiesen, damit die Stunden-Berechnung stimmt.
*/

CREATE OR REPLACE FUNCTION ensure_default_contract_for_teilnehmer(p_teilnehmer_id UUID)
RETURNS UUID AS $$
DECLARE
  v_existing_contract UUID;
  v_contract_id UUID;
  v_package_id UUID;
  v_tn RECORD;
  v_contract_number TEXT;
  v_hours_zivil NUMERIC;
  v_hours_straf NUMERIC;
  v_hours_oeff NUMERIC;
  v_hours_total NUMERIC;
  v_start DATE;
  v_end DATE;
BEGIN
  IF p_teilnehmer_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Falls schon Vertrag existiert, nichts tun
  SELECT id INTO v_existing_contract
  FROM contracts
  WHERE teilnehmer_id = p_teilnehmer_id
  LIMIT 1;

  IF v_existing_contract IS NOT NULL THEN
    RETURN v_existing_contract;
  END IF;

  -- Teilnehmerdaten laden
  SELECT * INTO v_tn FROM teilnehmer WHERE id = p_teilnehmer_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Vertragsnummer: tn_nummer oder Fallback
  v_contract_number := COALESCE(v_tn.tn_nummer, 'TN' || LPAD((floor(random() * 99999))::text, 5, '0'));
  -- Sicherstellen, dass die Vertragsnummer dem Format entspricht
  IF v_contract_number !~ '^TN[0-9]{4,5}(_[0-9]+)?$' THEN
    v_contract_number := 'TN' || LPAD((floor(random() * 99999))::text, 5, '0');
  END IF;
  -- Falls Vertragsnummer schon vergeben, anhängen _1, _2, ...
  WHILE EXISTS (SELECT 1 FROM contracts WHERE contract_number = v_contract_number) LOOP
    v_contract_number := v_contract_number || '_' || floor(random() * 9999)::text;
  END LOOP;

  v_hours_zivil := COALESCE(v_tn.hours_zivilrecht, 0);
  v_hours_straf := COALESCE(v_tn.hours_strafrecht, 0);
  v_hours_oeff  := COALESCE(v_tn.hours_oeffentliches_recht, 0);
  v_hours_total := v_hours_zivil + v_hours_straf + v_hours_oeff;

  IF v_hours_total <= 0 THEN
    v_hours_total := COALESCE(v_tn.booked_hours, 0);
  END IF;

  v_start := COALESCE(v_tn.contract_start, v_tn.active_since, CURRENT_DATE);
  v_end   := COALESCE(v_tn.contract_end, v_start + INTERVAL '1 year');

  -- Vertrag anlegen
  INSERT INTO contracts (
    teilnehmer_id, contract_number, start_date, end_date,
    total_hours, calculated_hours, free_hours_total,
    status, activated_at, created_at, updated_at
  ) VALUES (
    p_teilnehmer_id, v_contract_number, v_start, v_end,
    v_hours_total, v_hours_total, 0,
    'active', NOW(), NOW(), NOW()
  )
  RETURNING id INTO v_contract_id;

  -- Paket 1 anlegen
  INSERT INTO contract_packages (
    contract_id, teilnehmer_id, custom_name,
    hours_total, hours_used, status,
    start_date, end_date, created_at, updated_at
  ) VALUES (
    v_contract_id, p_teilnehmer_id, 'Paket 1',
    v_hours_total, 0, 'active',
    v_start, v_end, NOW(), NOW()
  )
  RETURNING id INTO v_package_id;

  -- Rechtsgebietsstunden aus Legacy-Feldern übernehmen
  IF v_hours_zivil > 0 THEN
    INSERT INTO contract_package_legal_areas (contract_package_id, legal_area, hours)
    VALUES (v_package_id, 'zivilrecht', v_hours_zivil);
  END IF;
  IF v_hours_straf > 0 THEN
    INSERT INTO contract_package_legal_areas (contract_package_id, legal_area, hours)
    VALUES (v_package_id, 'strafrecht', v_hours_straf);
  END IF;
  IF v_hours_oeff > 0 THEN
    INSERT INTO contract_package_legal_areas (contract_package_id, legal_area, hours)
    VALUES (v_package_id, 'oeffentliches_recht', v_hours_oeff);
  END IF;

  -- Bestehende participant_hours ohne contract_id/package_id diesem Default zuordnen
  UPDATE participant_hours
    SET contract_id = v_contract_id,
        package_id = v_package_id
    WHERE teilnehmer_id = p_teilnehmer_id
      AND (contract_id IS NULL OR package_id IS NULL);

  -- Neu berechnen (Freistunden-Pool + Paket-Used)
  PERFORM recompute_teilnehmer_hours_with_free(p_teilnehmer_id);

  RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger: Beim INSERT in participant_hours sicherstellen, dass ein Vertrag existiert
-- ============================================
CREATE OR REPLACE FUNCTION trg_ensure_default_contract_on_hours()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_package_id UUID;
BEGIN
  IF NEW.teilnehmer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Falls bereits ein Vertrag existiert, nichts tun
  IF EXISTS (SELECT 1 FROM contracts WHERE teilnehmer_id = NEW.teilnehmer_id) THEN
    RETURN NEW;
  END IF;

  v_contract_id := ensure_default_contract_for_teilnehmer(NEW.teilnehmer_id);

  IF v_contract_id IS NOT NULL AND NEW.contract_id IS NULL THEN
    NEW.contract_id := v_contract_id;
    SELECT id INTO v_package_id
    FROM contract_packages
    WHERE contract_id = v_contract_id
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_package_id IS NOT NULL AND NEW.package_id IS NULL THEN
      NEW.package_id := v_package_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_default_contract_on_hours ON participant_hours;
CREATE TRIGGER trigger_ensure_default_contract_on_hours
  BEFORE INSERT ON participant_hours
  FOR EACH ROW
  EXECUTE FUNCTION trg_ensure_default_contract_on_hours();

-- ============================================
-- Backfill: Alle Teilnehmer mit Stunden aber ohne Vertrag
-- ============================================
DO $$
DECLARE
  t UUID;
  v_count INT := 0;
BEGIN
  FOR t IN
    SELECT DISTINCT tn.id
    FROM teilnehmer tn
    JOIN participant_hours ph ON ph.teilnehmer_id = tn.id
    WHERE NOT EXISTS (SELECT 1 FROM contracts c WHERE c.teilnehmer_id = tn.id)
  LOOP
    PERFORM ensure_default_contract_for_teilnehmer(t);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfill abgeschlossen: % Default-Verträge erstellt', v_count;
END $$;
