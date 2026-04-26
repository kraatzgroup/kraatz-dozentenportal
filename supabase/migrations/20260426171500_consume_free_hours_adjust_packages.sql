/*
  # Erweiterung: Freistunden reduzieren auch Paket-Stunden
  
  Bisher: Trigger setzt free_hours.hours_used aufgrund von participant_hours.
  Problem: contract_packages.hours_used wurde nicht reduziert, daher
  doppelte Verbuchung.
  
  Neu: Eine umfassende Recompute-Funktion pro Vertrag, die:
  1. free_hours.hours_used neu setzt (älteste zuerst)
  2. contract_packages.hours_used neu berechnet als
     SUM(participant_hours pro package) - free credit pro package
  
  Free credit pro package wird durch chronologisches Abarbeiten der
  participant_hours (älteste zuerst, FIFO) zugeordnet.
*/

CREATE OR REPLACE FUNCTION recompute_contract_hours_with_free(p_contract_id UUID)
RETURNS VOID AS $$
DECLARE
  v_areas TEXT[] := ARRAY['zivilrecht', 'strafrecht', 'oeffentliches_recht', 'sonstiges'];
  v_area TEXT;
  ph RECORD;
  fh RECORD;
  v_remaining NUMERIC;
  v_consume NUMERIC;
  v_free_credits JSONB := '{}'::jsonb; -- { package_id: total_free_credit }
  v_pkg RECORD;
  v_credit NUMERIC;
BEGIN
  IF p_contract_id IS NULL THEN
    RETURN;
  END IF;

  -- Reset alle free_hours.hours_used dieses Vertrags
  UPDATE free_hours SET hours_used = 0, updated_at = NOW()
  WHERE contract_id = p_contract_id;

  -- Pro Rechtsgebiet: chronologisch participant_hours abarbeiten,
  -- Freistunden FIFO konsumieren, Credit pro package_id sammeln
  FOREACH v_area IN ARRAY v_areas LOOP
    -- Gesamte Freistunden dieses Rechtsgebiets im Vertrag
    SELECT COALESCE(SUM(hours), 0) INTO v_remaining
    FROM free_hours
    WHERE contract_id = p_contract_id AND legal_area = v_area;

    IF v_remaining <= 0 THEN
      CONTINUE;
    END IF;

    -- Walk participant_hours (FIFO)
    FOR ph IN
      SELECT id, hours, package_id
      FROM participant_hours
      WHERE contract_id = p_contract_id
        AND normalize_legal_area(legal_area) = v_area
      ORDER BY date ASC, created_at ASC, id ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_consume := LEAST(v_remaining, ph.hours);
      IF ph.package_id IS NOT NULL AND v_consume > 0 THEN
        v_credit := COALESCE((v_free_credits->>ph.package_id::text)::numeric, 0) + v_consume;
        v_free_credits := v_free_credits || jsonb_build_object(ph.package_id::text, v_credit);
      END IF;
      v_remaining := v_remaining - v_consume;
    END LOOP;

    -- Verteile konsumierte Freistunden auf free_hours-Einträge (FIFO)
    DECLARE
      v_consumed_total NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(hours), 0) - v_remaining INTO v_consumed_total
      FROM free_hours
      WHERE contract_id = p_contract_id AND legal_area = v_area;

      FOR fh IN
        SELECT id, hours
        FROM free_hours
        WHERE contract_id = p_contract_id AND legal_area = v_area
        ORDER BY created_at ASC, id ASC
      LOOP
        v_consume := LEAST(GREATEST(v_consumed_total, 0), fh.hours);
        UPDATE free_hours
          SET hours_used = v_consume, updated_at = NOW()
          WHERE id = fh.id;
        v_consumed_total := v_consumed_total - v_consume;
      END LOOP;
    END;
  END LOOP;

  -- Recompute contract_packages.hours_used =
  --   SUM(participant_hours pro package) - free_credit dieses packages
  FOR v_pkg IN
    SELECT id FROM contract_packages WHERE contract_id = p_contract_id
  LOOP
    DECLARE
      v_total_used NUMERIC;
      v_free_credit NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(hours), 0) INTO v_total_used
      FROM participant_hours
      WHERE package_id = v_pkg.id;

      v_free_credit := COALESCE((v_free_credits->>v_pkg.id::text)::numeric, 0);

      UPDATE contract_packages
        SET hours_used = GREATEST(0, v_total_used - v_free_credit),
            updated_at = NOW()
        WHERE id = v_pkg.id;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger-Funktion ersetzen, sodass sie die neue Recompute-Funktion nutzt
CREATE OR REPLACE FUNCTION trg_participant_hours_consume_free()
RETURNS TRIGGER AS $$
DECLARE
  v_contracts UUID[];
  v_contract UUID;
  i INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contracts := ARRAY[OLD.contract_id];
  ELSIF TG_OP = 'INSERT' THEN
    v_contracts := ARRAY[NEW.contract_id];
  ELSE
    v_contracts := ARRAY[NEW.contract_id, OLD.contract_id];
  END IF;

  FOR i IN 1..array_length(v_contracts, 1) LOOP
    v_contract := v_contracts[i];
    IF v_contract IS NOT NULL THEN
      PERFORM recompute_contract_hours_with_free(v_contract);
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auch bei free_hours-Änderungen neu berechnen
CREATE OR REPLACE FUNCTION trg_free_hours_recompute()
RETURNS TRIGGER AS $$
DECLARE
  v_contract UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract := OLD.contract_id;
  ELSE
    v_contract := NEW.contract_id;
  END IF;
  IF v_contract IS NOT NULL THEN
    PERFORM recompute_contract_hours_with_free(v_contract);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_free_hours_recompute ON free_hours;
CREATE TRIGGER trigger_free_hours_recompute
  AFTER INSERT OR UPDATE OF hours, legal_area, contract_id OR DELETE ON free_hours
  FOR EACH ROW
  EXECUTE FUNCTION trg_free_hours_recompute();

-- Backfill: alle Verträge mit free_hours oder participant_hours neu berechnen
DO $$
DECLARE
  c UUID;
BEGIN
  FOR c IN
    SELECT DISTINCT contract_id FROM (
      SELECT contract_id FROM participant_hours WHERE contract_id IS NOT NULL
      UNION
      SELECT contract_id FROM free_hours WHERE contract_id IS NOT NULL
    ) x
  LOOP
    PERFORM recompute_contract_hours_with_free(c);
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: Freistunden reduzieren jetzt auch Paket-Stunden';
END $$;
