/*
  # Fix: Doppelte Paket-1-Einträge bei Backfill
  
  Beim Erstellen eines contracts erzeugt ein bestehender Trigger
  (auto_create_first_package) bereits automatisch ein leeres Paket 1.
  Unser ensure_default_contract_for_teilnehmer hat dann ein zweites
  angelegt — daher Duplikate.
  
  Fix:
  1. Bereinige doppelte leere Pakete in den 55 Backfill-Verträgen
  2. Schreibe ensure_default_contract_for_teilnehmer um, damit das
     vom Trigger automatisch erstellte Paket genutzt wird.
*/

-- ============================================
-- 1. Cleanup: Lösche leere Duplikat-Pakete in Backfill-Verträgen
-- ============================================
DO $$
DECLARE
  c RECORD;
  v_kept UUID;
BEGIN
  FOR c IN
    SELECT contract_id
    FROM contract_packages
    GROUP BY contract_id
    HAVING COUNT(*) > 1
       AND COUNT(*) FILTER (WHERE hours_total > 0) >= 1
       AND COUNT(*) FILTER (WHERE hours_total = 0) >= 1
  LOOP
    -- Behalte das Paket mit hours_total > 0
    SELECT id INTO v_kept
    FROM contract_packages
    WHERE contract_id = c.contract_id AND hours_total > 0
    ORDER BY created_at ASC LIMIT 1;

    -- Lösche leere Pakete (hours_total = 0, keine participant_hours referenzieren)
    DELETE FROM contract_packages
    WHERE contract_id = c.contract_id
      AND hours_total = 0
      AND id != v_kept
      AND NOT EXISTS (SELECT 1 FROM participant_hours WHERE package_id = contract_packages.id);
  END LOOP;
END $$;

-- ============================================
-- 2. Funktion neu schreiben: nutzt vom Trigger erstelltes Paket
-- ============================================
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

  SELECT id INTO v_existing_contract
  FROM contracts
  WHERE teilnehmer_id = p_teilnehmer_id
  LIMIT 1;

  IF v_existing_contract IS NOT NULL THEN
    RETURN v_existing_contract;
  END IF;

  SELECT * INTO v_tn FROM teilnehmer WHERE id = p_teilnehmer_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_contract_number := COALESCE(v_tn.tn_nummer, 'TN' || LPAD((floor(random() * 99999))::text, 5, '0'));
  IF v_contract_number !~ '^TN[0-9]{4,5}(_[0-9]+)?$' THEN
    v_contract_number := 'TN' || LPAD((floor(random() * 99999))::text, 5, '0');
  END IF;
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

  -- Vertrag anlegen (Trigger auto_create_first_package erstellt automatisch Paket 1)
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

  -- Auto-erstelltes Paket 1 finden und aktualisieren
  SELECT id INTO v_package_id
  FROM contract_packages
  WHERE contract_id = v_contract_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_package_id IS NOT NULL THEN
    UPDATE contract_packages
      SET hours_total = v_hours_total,
          updated_at = NOW()
      WHERE id = v_package_id;

    IF v_hours_zivil > 0 THEN
      INSERT INTO contract_package_legal_areas (contract_package_id, legal_area, hours)
      VALUES (v_package_id, 'zivilrecht', v_hours_zivil)
      ON CONFLICT (contract_package_id, legal_area) DO UPDATE SET hours = EXCLUDED.hours;
    END IF;
    IF v_hours_straf > 0 THEN
      INSERT INTO contract_package_legal_areas (contract_package_id, legal_area, hours)
      VALUES (v_package_id, 'strafrecht', v_hours_straf)
      ON CONFLICT (contract_package_id, legal_area) DO UPDATE SET hours = EXCLUDED.hours;
    END IF;
    IF v_hours_oeff > 0 THEN
      INSERT INTO contract_package_legal_areas (contract_package_id, legal_area, hours)
      VALUES (v_package_id, 'oeffentliches_recht', v_hours_oeff)
      ON CONFLICT (contract_package_id, legal_area) DO UPDATE SET hours = EXCLUDED.hours;
    END IF;
  END IF;

  -- Bestehende participant_hours dem neuen Default zuordnen
  UPDATE participant_hours
    SET contract_id = v_contract_id,
        package_id = v_package_id
    WHERE teilnehmer_id = p_teilnehmer_id
      AND (contract_id IS NULL OR package_id IS NULL);

  PERFORM recompute_teilnehmer_hours_with_free(p_teilnehmer_id);

  RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql;
