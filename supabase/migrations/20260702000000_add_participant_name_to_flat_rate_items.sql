-- Migration: Add participant_name column to dozent_flat_rate_items table
-- Created: 2026-07-02
-- Description: Adds participant_name column for Probestunden category to track trial lesson participant names

-- ============================================
-- Add participant_name column
-- ============================================
ALTER TABLE dozent_flat_rate_items
ADD COLUMN participant_name TEXT;

-- ============================================
-- Add comment
-- ============================================
COMMENT ON COLUMN dozent_flat_rate_items.participant_name IS 'Name of the participant for Probestunden (trial lessons)';

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: participant_name column added to dozent_flat_rate_items';
  RAISE NOTICE '- New column: participant_name (TEXT)';
  RAISE NOTICE '- Used for: Probestunden category to store participant name for invoices';
END $$;
