/*
  # Free Hours werden bei Stundeneintrag zuerst verbraucht
  
  Wenn ein Dozent Stunden für einen Teilnehmer einträgt, sollen verfügbare
  Freistunden (free_hours) für das jeweilige Rechtsgebiet ZUERST aufgebraucht
  werden, bevor die regulären Paketstunden belastet werden.
  
  Implementierung:
  1. Neue Spalte free_hours.hours_used (NUMERIC, default 0)
  2. Trigger auf participant_hours INSERT/UPDATE/DELETE:
     - Berechnet nach jeder Änderung neu, wie viele Freistunden pro
       (contract_id, legal_area) verbraucht sein sollten
     - Verteilt verbrauchte Stunden auf free_hours (älteste zuerst)
*/

-- ============================================
-- 1. Spalte hours_used in free_hours
-- ============================================
ALTER TABLE free_hours
  ADD COLUMN IF NOT EXISTS hours_used NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE free_hours
  DROP CONSTRAINT IF EXISTS free_hours_hours_used_valid;
ALTER TABLE free_hours
  ADD CONSTRAINT free_hours_hours_used_valid CHECK (hours_used >= 0 AND hours_used <= hours);

-- ============================================
-- 2. Helper: Normalisiert legal_area-Strings
--    (Frontend speichert teilweise 'Strafrecht', 'öffentliches Recht')
-- ============================================
CREATE OR REPLACE FUNCTION normalize_legal_area(p_value TEXT)
RETURNS TEXT AS $$
DECLARE
  v_lower TEXT;
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  v_lower := LOWER(p_value);
  v_lower := REPLACE(v_lower, 'ö', 'oe');
  v_lower := REPLACE(v_lower, ' ', '_');
  IF v_lower IN ('zivilrecht', 'strafrecht', 'oeffentliches_recht', 'sonstiges') THEN
    RETURN v_lower;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. Funktion: Verteilt verbrauchte Stunden eines Vertrags+Rechtsgebiets
--    auf die zugehörigen free_hours (älteste zuerst).
-- ============================================
CREATE OR REPLACE FUNCTION reallocate_free_hours_usage(
  p_contract_id UUID,
  p_legal_area TEXT
) RETURNS VOID AS $$
DECLARE
  v_total_consumed NUMERIC;
  v_remaining NUMERIC;
  fh RECORD;
  v_consume NUMERIC;
BEGIN
  IF p_contract_id IS NULL OR p_legal_area IS NULL THEN
    RETURN;
  END IF;

  -- Summe der eingetragenen Stunden für (contract, legal_area)
  SELECT COALESCE(SUM(hours), 0)
    INTO v_total_consumed
  FROM participant_hours
  WHERE contract_id = p_contract_id
    AND normalize_legal_area(legal_area) = p_legal_area;

  v_remaining := v_total_consumed;

  -- Verteile auf free_hours (älteste zuerst)
  FOR fh IN
    SELECT id, hours
    FROM free_hours
    WHERE contract_id = p_contract_id
      AND legal_area = p_legal_area
    ORDER BY created_at ASC, id ASC
  LOOP
    v_consume := LEAST(GREATEST(v_remaining, 0), fh.hours);
    UPDATE free_hours
      SET hours_used = v_consume,
          updated_at = NOW()
      WHERE id = fh.id;
    v_remaining := v_remaining - v_consume;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Trigger-Funktion auf participant_hours
-- ============================================
CREATE OR REPLACE FUNCTION trg_participant_hours_consume_free()
RETURNS TRIGGER AS $$
DECLARE
  v_contracts UUID[];
  v_areas TEXT[];
  v_contract UUID;
  v_area TEXT;
  i INT;
BEGIN
  -- Sammle betroffene (contract_id, legal_area) Kombinationen
  IF TG_OP = 'DELETE' THEN
    v_contracts := ARRAY[OLD.contract_id];
    v_areas := ARRAY[normalize_legal_area(OLD.legal_area)];
  ELSIF TG_OP = 'INSERT' THEN
    v_contracts := ARRAY[NEW.contract_id];
    v_areas := ARRAY[normalize_legal_area(NEW.legal_area)];
  ELSE -- UPDATE
    v_contracts := ARRAY[NEW.contract_id, OLD.contract_id];
    v_areas := ARRAY[normalize_legal_area(NEW.legal_area), normalize_legal_area(OLD.legal_area)];
  END IF;

  FOR i IN 1..array_length(v_contracts, 1) LOOP
    v_contract := v_contracts[i];
    v_area := v_areas[i];
    IF v_contract IS NOT NULL AND v_area IS NOT NULL THEN
      PERFORM reallocate_free_hours_usage(v_contract, v_area);
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_participant_hours_consume_free ON participant_hours;
CREATE TRIGGER trigger_participant_hours_consume_free
  AFTER INSERT OR UPDATE OR DELETE ON participant_hours
  FOR EACH ROW
  EXECUTE FUNCTION trg_participant_hours_consume_free();

-- ============================================
-- 5. Backfill: bestehende Daten neu allokieren
-- ============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT contract_id, normalize_legal_area(legal_area) AS legal_area
    FROM participant_hours
    WHERE contract_id IS NOT NULL
  LOOP
    IF r.legal_area IS NOT NULL THEN
      PERFORM reallocate_free_hours_usage(r.contract_id, r.legal_area);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- Log
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: Freistunden werden bei Stundeneintrag zuerst verbraucht';
  RAISE NOTICE '- Neue Spalte: free_hours.hours_used';
  RAISE NOTICE '- Trigger: trigger_participant_hours_consume_free';
  RAISE NOTICE '- Funktion: reallocate_free_hours_usage(contract_id, legal_area)';
END $$;
