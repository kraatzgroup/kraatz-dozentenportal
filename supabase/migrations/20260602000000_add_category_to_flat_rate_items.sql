-- Migration: Add category column to dozent_flat_rate_items table
-- Created: 2026-06-02
-- Description: Adds category column to track flat-rate item types (Auslagen, Reisekosten, Pauschalvereinbarungen)

-- ============================================
-- Add category column
-- ============================================
ALTER TABLE dozent_flat_rate_items
ADD COLUMN category TEXT;

-- Add constraint to ensure valid categories
ALTER TABLE dozent_flat_rate_items
ADD CONSTRAINT check_valid_category
CHECK (category IN ('Auslagen', 'Reisekosten', 'Pauschalvereinbarungen'));

-- ============================================
-- Add comment
-- ============================================
COMMENT ON COLUMN dozent_flat_rate_items.category IS 'Category of the flat-rate item (Auslagen, Reisekosten, Pauschalvereinbarungen)';

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: category column added to dozent_flat_rate_items';
  RAISE NOTICE '- New column: category (TEXT)';
  RAISE NOTICE '- Valid values: Auslagen, Reisekosten, Pauschalvereinbarungen';
END $$;
