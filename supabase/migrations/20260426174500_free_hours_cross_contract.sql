/*
  # Freistunden Vertrags-übergreifend konsumieren
  
  Bisher: Freistunden konnten nur innerhalb desselben Vertrags wie der
  Stundeneintrag verbraucht werden.
  
  Neu: Alle Freistunden eines Teilnehmers (über alle seine Verträge) bilden
  einen Pool pro Rechtsgebiet. Stundeneinträge konsumieren FIFO aus diesem Pool,
  unabhängig vom konkreten Vertrag.
*/

CREATE OR REPLACE FUNCTION recompute_teilnehmer_hours_with_free(p_teilnehmer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_areas TEXT[] := ARRAY['zivilrecht', 'strafrecht', 'oeffentliches_recht', 'sonstiges'];
  v_area TEXT;
  v_contract_ids UUID[];
  ph RECORD;
  fh RECORD;
  v_remaining NUMERIC;
  v_consume NUMERIC;
  v_free_credits JSONB;
  v_pkg RECORD;
  v_credit NUMERIC;
  v_consumed_total NUMERIC;
  v_total_used NUMERIC;
  v_free_credit NUMERIC;
BEGIN
  IF p_teilnehmer_id IS NULL THEN
    RETURN;
  END IF;

  -- Alle Vertrags-IDs dieses Teilnehmers
  SELECT array_agg(id) INTO v_contract_ids
  FROM contracts
  WHERE teilnehmer_id = p_teilnehmer_id;

  IF v_contract_ids IS NULL OR array_length(v_contract_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Reset alle free_hours.hours_used dieses Teilnehmers
  UPDATE free_hours SET hours_used = 0, updated_at = NOW()
  WHERE contract_id = ANY(v_contract_ids);

  v_free_credits := '{}'::jsonb;

  FOREACH v_area IN ARRAY v_areas LOOP
    -- Gesamtpool an Freistunden für dieses Rechtsgebiet (über alle Verträge)
    SELECT COALESCE(SUM(hours), 0) INTO v_remaining
    FROM free_hours
    WHERE contract_id = ANY(v_contract_ids) AND legal_area = v_area;

    IF v_remaining <= 0 THEN
      CONTINUE;
    END IF;

    -- participant_hours aller Verträge dieses Teilnehmers chronologisch
    FOR ph IN
      SELECT id, hours, package_id
      FROM participant_hours
      WHERE contract_id = ANY(v_contract_ids)
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

    -- Verteile konsumierte Freistunden auf free_hours-Einträge (FIFO über Verträge hinweg)
    SELECT COALESCE(SUM(hours), 0) - v_remaining INTO v_consumed_total
    FROM free_hours
    WHERE contract_id = ANY(v_contract_ids) AND legal_area = v_area;

    FOR fh IN
      SELECT id, hours
      FROM free_hours
      WHERE contract_id = ANY(v_contract_ids) AND legal_area = v_area
      ORDER BY created_at ASC, id ASC
    LOOP
      v_consume := LEAST(GREATEST(v_consumed_total, 0), fh.hours);
      UPDATE free_hours
        SET hours_used = v_consume, updated_at = NOW()
        WHERE id = fh.id;
      v_consumed_total := v_consumed_total - v_consume;
    END LOOP;
  END LOOP;

  -- Recompute alle Pakete dieses Teilnehmers
  FOR v_pkg IN
    SELECT cp.id FROM contract_packages cp
    WHERE cp.contract_id = ANY(v_contract_ids)
  LOOP
    SELECT COALESCE(SUM(hours), 0) INTO v_total_used
    FROM participant_hours
    WHERE package_id = v_pkg.id;

    v_free_credit := COALESCE((v_free_credits->>v_pkg.id::text)::numeric, 0);

    UPDATE contract_packages
      SET hours_used = GREATEST(0, v_total_used - v_free_credit),
          updated_at = NOW()
      WHERE id = v_pkg.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger-Funktion: nutzt jetzt die teilnehmer-basierte Recompute
CREATE OR REPLACE FUNCTION trg_participant_hours_consume_free()
RETURNS TRIGGER AS $$
DECLARE
  v_teilnehmer UUID;
  v_other_teilnehmer UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_teilnehmer := OLD.teilnehmer_id;
  ELSE
    v_teilnehmer := NEW.teilnehmer_id;
    IF TG_OP = 'UPDATE' AND OLD.teilnehmer_id IS DISTINCT FROM NEW.teilnehmer_id THEN
      v_other_teilnehmer := OLD.teilnehmer_id;
    END IF;
  END IF;

  IF v_teilnehmer IS NOT NULL THEN
    PERFORM recompute_teilnehmer_hours_with_free(v_teilnehmer);
  END IF;
  IF v_other_teilnehmer IS NOT NULL THEN
    PERFORM recompute_teilnehmer_hours_with_free(v_other_teilnehmer);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger auf free_hours: bei Änderung den Teilnehmer neu berechnen
CREATE OR REPLACE FUNCTION trg_free_hours_recompute()
RETURNS TRIGGER AS $$
DECLARE
  v_contract UUID;
  v_teilnehmer UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract := OLD.contract_id;
  ELSE
    v_contract := NEW.contract_id;
  END IF;
  IF v_contract IS NOT NULL THEN
    SELECT teilnehmer_id INTO v_teilnehmer FROM contracts WHERE id = v_contract;
    IF v_teilnehmer IS NOT NULL THEN
      PERFORM recompute_teilnehmer_hours_with_free(v_teilnehmer);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: alle Teilnehmer neu berechnen
DO $$
DECLARE
  t UUID;
BEGIN
  FOR t IN
    SELECT DISTINCT teilnehmer_id FROM contracts WHERE teilnehmer_id IS NOT NULL
  LOOP
    PERFORM recompute_teilnehmer_hours_with_free(t);
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Freistunden werden jetzt vertragsübergreifend pro Teilnehmer konsumiert (FIFO)';
END $$;
