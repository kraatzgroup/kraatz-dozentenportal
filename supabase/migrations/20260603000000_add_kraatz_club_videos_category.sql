-- Migration: Add Kraatz Club Videos category to flat rate items
-- Created: 2026-06-03
-- Description: Adds 'Kraatz Club Videos' as a valid category for flat-rate items

-- ============================================
-- Drop old constraint and add new one
-- ============================================
ALTER TABLE dozent_flat_rate_items
DROP CONSTRAINT IF EXISTS check_valid_category;

ALTER TABLE dozent_flat_rate_items
ADD CONSTRAINT check_valid_category
CHECK (category IN ('Auslagen', 'Reisekosten', 'Pauschalvereinbarungen', 'Kraatz Club Videos'));

-- ============================================
-- Update comment
-- ============================================
COMMENT ON COLUMN dozent_flat_rate_items.category IS 'Category of the flat-rate item (Auslagen, Reisekosten, Pauschalvereinbarungen, Kraatz Club Videos)';

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: Kraatz Club Videos category added';
  RAISE NOTICE '- Valid categories: Auslagen, Reisekosten, Pauschalvereinbarungen, Kraatz Club Videos';
END $$;
