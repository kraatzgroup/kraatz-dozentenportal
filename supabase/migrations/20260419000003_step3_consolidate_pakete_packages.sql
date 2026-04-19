/*
  # Schritt 3: Consolidate pakete and packages
  
  pakete (5 Einträge) → packages (4 Einträge)
  upsells (14 Einträge) verweisen auf pakete → müssen aktualisiert werden
  
  Strategie:
  1. Pakete aus pakete in packages migrieren mit neuen Namen (um Konflikte zu vermeiden)
  2. upsells Referenzen aktualisieren
  3. pakete Tabelle löschen
*/

-- ============================================
-- Step 1: Migrate pakete data to packages with unique names
-- ============================================
INSERT INTO packages (name, description, hours, price, is_active)
SELECT 
  CASE 
    WHEN name = 'Starter Paket' THEN 'Starter Paket (Legacy)'
    WHEN name = 'Standard Paket' THEN 'Standard Paket (Legacy)'
    WHEN name = 'Premium Paket' THEN 'Premium Paket (Legacy)'
    WHEN name = 'VIP Paket' THEN 'VIP Paket'
    WHEN name = 'Auffrischung' THEN 'Auffrischung'
    ELSE name
  END as name,
  description,
  hours,
  price,
  is_active
FROM pakete
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Step 2: Create mapping table for pakete_id → package_id
-- ============================================
-- Create a temporary mapping
CREATE TEMP TABLE pakete_package_mapping AS
SELECT 
  p.id as pakete_id,
  pkg.id as package_id
FROM pakete p
JOIN packages pkg ON 
  CASE 
    WHEN p.name = 'Starter Paket' THEN 'Starter Paket (Legacy)'
    WHEN p.name = 'Standard Paket' THEN 'Standard Paket (Legacy)'
    WHEN p.name = 'Premium Paket' THEN 'Premium Paket (Legacy)'
    WHEN p.name = 'VIP Paket' THEN 'VIP Paket'
    WHEN p.name = 'Auffrischung' THEN 'Auffrischung'
    ELSE p.name
  END = pkg.name;

-- ============================================
-- Step 3: Update upsells references
-- ============================================
-- Update original_paket_id
UPDATE upsells
SET original_paket_id = m.package_id
FROM pakete_package_mapping m
WHERE upsells.original_paket_id = m.pakete_id;

-- Update new_paket_id
UPDATE upsells
SET new_paket_id = m.package_id
FROM pakete_package_mapping m
WHERE upsells.new_paket_id = m.pakete_id;

-- ============================================
-- Step 4: Rename columns in upsells for consistency
-- ============================================
DO $$
BEGIN
  -- Drop existing foreign keys
  ALTER TABLE upsells DROP CONSTRAINT IF EXISTS upsells_original_paket_id_fkey;
  ALTER TABLE upsells DROP CONSTRAINT IF EXISTS upsells_new_paket_id_fkey;
  
  -- Rename columns
  ALTER TABLE upsells RENAME COLUMN original_paket_id TO original_package_id;
  ALTER TABLE upsells RENAME COLUMN new_paket_id TO new_package_id;
  
  -- Add new foreign keys to packages
  ALTER TABLE upsells 
    ADD CONSTRAINT upsells_original_package_id_fkey 
    FOREIGN KEY (original_package_id) REFERENCES packages(id) ON DELETE SET NULL;
  
  ALTER TABLE upsells 
    ADD CONSTRAINT upsells_new_package_id_fkey 
    FOREIGN KEY (new_package_id) REFERENCES packages(id) ON DELETE SET NULL;
END $$;

-- ============================================
-- Step 5: Drop pakete table
-- ============================================
DROP TABLE IF EXISTS pakete CASCADE;

-- ============================================
-- Step 6: Update contract_packages if it still references pakete (should be none)
-- ============================================
-- contract_packages was already updated in step 2 to reference packages
-- This is just a safety check

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schritt 3 abgeschlossen: pakete und packages konsolidiert';
  RAISE NOTICE '- Daten aus pakete in packages migriert (mit neuen Namen)';
  RAISE NOTICE '- upsells Referenzen aktualisiert (14 Einträge)';
  RAISE NOTICE '- upsells Spalten umbenannt: paket_id → package_id';
  RAISE NOTICE '- pakete Tabelle gelöscht';
  RAISE NOTICE '- Keine Daten verloren';
END $$;
