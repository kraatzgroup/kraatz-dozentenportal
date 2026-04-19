-- Create contract_package_legal_areas table for per-contract-package legal areas
CREATE TABLE IF NOT EXISTS contract_package_legal_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_package_id UUID NOT NULL REFERENCES contract_packages(id) ON DELETE CASCADE,
  legal_area TEXT NOT NULL CHECK (legal_area = ANY (ARRAY['zivilrecht'::text, 'strafrecht'::text, 'oeffentliches_recht'::text, 'sonstiges'::text])),
  hours INTEGER NOT NULL CHECK (hours >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (contract_package_id, legal_area)
);

CREATE INDEX IF NOT EXISTS idx_contract_package_legal_areas_cp_id ON contract_package_legal_areas(contract_package_id);
CREATE INDEX IF NOT EXISTS idx_contract_package_legal_areas_legal_area ON contract_package_legal_areas(legal_area);

-- Enable RLS
ALTER TABLE contract_package_legal_areas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "contract_package_legal_areas_select" ON contract_package_legal_areas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['admin'::text, 'vertrieb'::text, 'buchhaltung'::text, 'verwaltung'::text])
  ));

CREATE POLICY "contract_package_legal_areas_all_admin" ON contract_package_legal_areas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text
  ));

CREATE POLICY "contract_package_legal_areas_insert_vertrieb" ON contract_package_legal_areas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['admin'::text, 'vertrieb'::text])
  ));

CREATE POLICY "contract_package_legal_areas_update_vertrieb" ON contract_package_legal_areas
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['admin'::text, 'vertrieb'::text])
  ));

-- Migrate existing data: for each contract_package, copy its package's legal areas
INSERT INTO contract_package_legal_areas (contract_package_id, legal_area, hours)
SELECT cp.id, pla.legal_area, pla.hours
FROM contract_packages cp
JOIN package_legal_areas pla ON pla.package_id = cp.package_id
ON CONFLICT (contract_package_id, legal_area) DO NOTHING;

COMMENT ON TABLE contract_package_legal_areas IS 'Legal area hours configured per contract_package instance (not shared across contracts).';
