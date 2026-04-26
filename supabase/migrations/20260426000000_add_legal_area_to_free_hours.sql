/*
  # Add legal_area to free_hours table
  
  Diese Migration fügt eine legal_area Spalte zur free_hours Tabelle hinzu,
  um Freistunden pro Rechtsgebiet zu ermöglichen.
*/

-- ============================================
-- Add legal_area column to free_hours
-- ============================================
ALTER TABLE free_hours 
  ADD COLUMN IF NOT EXISTS legal_area TEXT CHECK (legal_area IN ('zivilrecht', 'strafrecht', 'oeffentliches_recht', 'sonstiges'));

-- ============================================
-- Create index for legal_area
-- ============================================
CREATE INDEX IF NOT EXISTS idx_free_hours_legal_area ON free_hours(legal_area);

-- ============================================
-- Function: Calculate free hours per legal area for a contract
-- ============================================
CREATE OR REPLACE FUNCTION calculate_contract_free_hours_by_legal_area(p_contract_id UUID, p_legal_area TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_total_hours INTEGER;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
  FROM free_hours
  WHERE contract_id = p_contract_id 
  AND legal_area = p_legal_area;
  
  RETURN v_total_hours;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get free hours breakdown for a contract
-- ============================================
CREATE OR REPLACE FUNCTION get_contract_free_hours_breakdown(p_contract_id UUID)
RETURNS TABLE (
  legal_area TEXT,
  hours INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(legal_area, 'ohne_zuordnung') AS legal_area,
    COALESCE(SUM(hours), 0) AS hours
  FROM free_hours
  WHERE contract_id = p_contract_id
  GROUP BY legal_area
  ORDER BY legal_area;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Update view to include legal area breakdown
-- ============================================
DROP VIEW IF EXISTS teilnehmer_contracts_overview;
CREATE OR REPLACE VIEW teilnehmer_contracts_overview AS
SELECT 
  t.id AS teilnehmer_id,
  t.tn_nummer,
  t.name AS teilnehmer_name,
  t.email,
  c.id AS contract_id,
  c.contract_number,
  c.start_date,
  c.end_date,
  c.status AS contract_status,
  c.total_hours,
  c.free_hours_total,
  c.calculated_hours,
  COUNT(DISTINCT cp.id) AS package_count,
  COUNT(DISTINCT fh.id) AS free_hours_count,
  -- Free hours per legal area
  COALESCE(SUM(fh.hours) FILTER (WHERE fh.legal_area = 'zivilrecht'), 0) AS free_hours_zivilrecht,
  COALESCE(SUM(fh.hours) FILTER (WHERE fh.legal_area = 'strafrecht'), 0) AS free_hours_strafrecht,
  COALESCE(SUM(fh.hours) FILTER (WHERE fh.legal_area = 'oeffentliches_recht'), 0) AS free_hours_oeffentliches_recht,
  COALESCE(SUM(fh.hours) FILTER (WHERE fh.legal_area = 'sonstiges'), 0) AS free_hours_sonstiges,
  COALESCE(SUM(fh.hours) FILTER (WHERE fh.legal_area IS NULL), 0) AS free_hours_ohne_zuordnung
FROM teilnehmer t
LEFT JOIN contracts c ON t.id = c.teilnehmer_id
LEFT JOIN contract_packages cp ON c.id = cp.contract_id
LEFT JOIN free_hours fh ON c.id = fh.contract_id
GROUP BY t.id, t.tn_nummer, t.name, t.email, c.id, c.contract_number, c.start_date, c.end_date, c.status, c.total_hours, c.free_hours_total, c.calculated_hours;

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: legal_area zu free_hours hinzugefügt';
  RAISE NOTICE '- Neue Spalte: free_hours.legal_area';
  RAISE NOTICE '- Neue Funktion: calculate_contract_free_hours_by_legal_area';
  RAISE NOTICE '- Neue Funktion: get_contract_free_hours_breakdown';
  RAISE NOTICE '- View aktualisiert: teilnehmer_contracts_overview';
END $$;
