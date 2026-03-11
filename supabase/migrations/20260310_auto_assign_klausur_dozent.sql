-- Migration: Auto-assign Dozent to Klausuren based on Legal Area
-- Date: 2026-03-10
-- Purpose: Automatically assign the correct dozent when a klausur is submitted

-- Function to get the dozent for a specific legal area in an elite kleingruppe
CREATE OR REPLACE FUNCTION get_dozent_for_legal_area(
  p_elite_kleingruppe_id UUID,
  p_legal_area TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_dozent_id UUID;
BEGIN
  -- Find the dozent assigned to this legal area in this elite kleingruppe
  SELECT dozent_id INTO v_dozent_id
  FROM elite_kleingruppe_dozenten
  WHERE elite_kleingruppe_id = p_elite_kleingruppe_id
    AND legal_area = p_legal_area
  LIMIT 1;
  
  RETURN v_dozent_id;
END;
$$;

-- Trigger function to auto-assign dozent when klausur is inserted
CREATE OR REPLACE FUNCTION auto_assign_klausur_dozent()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_elite_kleingruppe_id UUID;
  v_dozent_id UUID;
BEGIN
  -- Get the elite_kleingruppe_id from the teilnehmer
  SELECT elite_kleingruppe_id INTO v_elite_kleingruppe_id
  FROM teilnehmer
  WHERE id = NEW.teilnehmer_id;
  
  -- If teilnehmer is in an elite kleingruppe, assign the appropriate dozent
  IF v_elite_kleingruppe_id IS NOT NULL THEN
    v_dozent_id := get_dozent_for_legal_area(v_elite_kleingruppe_id, NEW.legal_area);
    
    -- Only set dozent_id if it's not already set and we found a matching dozent
    IF NEW.dozent_id IS NULL AND v_dozent_id IS NOT NULL THEN
      NEW.dozent_id := v_dozent_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign dozent before insert
DROP TRIGGER IF EXISTS trigger_auto_assign_klausur_dozent ON elite_kleingruppe_klausuren;
CREATE TRIGGER trigger_auto_assign_klausur_dozent
  BEFORE INSERT ON elite_kleingruppe_klausuren
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_klausur_dozent();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dozent_for_legal_area(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_assign_klausur_dozent() TO authenticated;

COMMENT ON FUNCTION get_dozent_for_legal_area(UUID, TEXT) IS 
'Returns the dozent_id for a specific legal area in an elite kleingruppe';

COMMENT ON FUNCTION auto_assign_klausur_dozent() IS 
'Trigger function that automatically assigns the correct dozent to a klausur based on the teilnehmer''s elite_kleingruppe_id and the klausur''s legal_area';
