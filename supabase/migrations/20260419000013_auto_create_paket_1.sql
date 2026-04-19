-- Auto-create "Paket 1" when a contract is inserted (per-contract, no global package dependency)
CREATE OR REPLACE FUNCTION auto_create_first_package()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contract_packages (
    contract_id,
    teilnehmer_id,
    package_id,
    custom_name,
    hours_total,
    hours_used,
    status,
    start_date,
    end_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.teilnehmer_id,
    NULL,
    'Paket 1',
    0,
    0,
    'active',
    NEW.start_date,
    NEW.end_date,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_first_package ON contracts;
CREATE TRIGGER trigger_auto_create_first_package
AFTER INSERT ON contracts
FOR EACH ROW
EXECUTE FUNCTION auto_create_first_package();

-- Backfill: create Paket 1 for any existing contract that has no packages
INSERT INTO contract_packages (
  contract_id, teilnehmer_id, package_id, custom_name,
  hours_total, hours_used, status, start_date, end_date, created_at, updated_at
)
SELECT
  c.id, c.teilnehmer_id, NULL, 'Paket 1',
  0, 0, 'active', c.start_date, c.end_date, NOW(), NOW()
FROM contracts c
WHERE NOT EXISTS (
  SELECT 1 FROM contract_packages cp WHERE cp.contract_id = c.id
);
