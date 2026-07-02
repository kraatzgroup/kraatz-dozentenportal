-- Migration: Update category constraint to include Probestunden
-- Created: 2026-07-02
-- Description: Updates check_valid_category constraint to include Probestunden category

-- ============================================
-- Drop old constraint
-- ============================================
ALTER TABLE dozent_flat_rate_items
DROP CONSTRAINT IF EXISTS check_valid_category;

-- ============================================
-- Add new constraint with updated categories
-- ============================================
ALTER TABLE dozent_flat_rate_items
ADD CONSTRAINT check_valid_category
CHECK (category IN ('Auslagen', 'Kraatz Club Videos', 'Probestunden'));

-- ============================================
-- Update comment
-- ============================================
COMMENT ON COLUMN dozent_flat_rate_items.category IS 'Category of the flat-rate item (Auslagen, Kraatz Club Videos, Probestunden)';

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: category constraint updated to include Probestunden';
  RAISE NOTICE '- Valid categories: Auslagen, Kraatz Club Videos, Probestunden';
END $$;
