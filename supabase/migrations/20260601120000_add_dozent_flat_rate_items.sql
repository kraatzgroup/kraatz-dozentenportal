-- Migration: Add dozent_flat_rate_items table for flat-rate compensation (sonstige Posten)
-- Created: 2026-06-01
-- Description: Allows dozents to add flat-rate items with name, description, quantity, and amount

-- ============================================
-- Create dozent_flat_rate_items table
-- ============================================
CREATE TABLE IF NOT EXISTS dozent_flat_rate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dozent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Item details
  name TEXT NOT NULL,
  description TEXT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount_euro DECIMAL(10,2) NOT NULL CHECK (amount_euro >= 0),
  
  -- Calculated total (quantity * amount_euro)
  total_euro DECIMAL(10,2) GENERATED ALWAYS AS (quantity * amount_euro) STORED,
  
  -- Date for invoice assignment
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dozent_flat_rate_items_dozent_id ON dozent_flat_rate_items(dozent_id);
CREATE INDEX IF NOT EXISTS idx_dozent_flat_rate_items_date ON dozent_flat_rate_items(date);
CREATE INDEX IF NOT EXISTS idx_dozent_flat_rate_items_dozent_date ON dozent_flat_rate_items(dozent_id, date);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE dozent_flat_rate_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Dozenten can view their own flat rate items
CREATE POLICY "Dozenten can view their own flat rate items"
  ON dozent_flat_rate_items
  FOR SELECT
  TO authenticated
  USING (dozent_id = auth.uid());

-- Dozenten can insert their own flat rate items
CREATE POLICY "Dozenten can insert their own flat rate items"
  ON dozent_flat_rate_items
  FOR INSERT
  TO authenticated
  WITH CHECK (dozent_id = auth.uid());

-- Dozenten can update their own flat rate items
CREATE POLICY "Dozenten can update their own flat rate items"
  ON dozent_flat_rate_items
  FOR UPDATE
  TO authenticated
  USING (dozent_id = auth.uid());

-- Dozenten can delete their own flat rate items
CREATE POLICY "Dozenten can delete their own flat rate items"
  ON dozent_flat_rate_items
  FOR DELETE
  TO authenticated
  USING (dozent_id = auth.uid());

-- Admins can view all flat rate items
CREATE POLICY "Admins can view all flat rate items"
  ON dozent_flat_rate_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Buchhaltung can view all flat rate items
CREATE POLICY "Buchhaltung can view all flat rate items"
  ON dozent_flat_rate_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (role = 'buchhaltung' OR 'buchhaltung' = ANY(additional_roles))
    )
  );

-- ============================================
-- Trigger for updated_at
-- ============================================
CREATE TRIGGER update_dozent_flat_rate_items_updated_at
  BEFORE UPDATE ON dozent_flat_rate_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE dozent_flat_rate_items IS 'Flat-rate compensation items for dozents (sonstige Posten)';
COMMENT ON COLUMN dozent_flat_rate_items.name IS 'Name of the flat-rate item';
COMMENT ON COLUMN dozent_flat_rate_items.description IS 'Description of the item';
COMMENT ON COLUMN dozent_flat_rate_items.quantity IS 'Quantity/amount';
COMMENT ON COLUMN dozent_flat_rate_items.amount_euro IS 'Amount in Euro per unit';
COMMENT ON COLUMN dozent_flat_rate_items.total_euro IS 'Calculated total (quantity * amount_euro)';
COMMENT ON COLUMN dozent_flat_rate_items.date IS 'Date for invoice assignment';

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration abgeschlossen: dozent_flat_rate_items Tabelle erstellt';
  RAISE NOTICE '- Neue Tabelle: dozent_flat_rate_items';
  RAISE NOTICE '- Spalten: name, description, quantity, amount_euro, total_euro (berechnet)';
  RAISE NOTICE '- RLS Policies für Dozenten, Admins und Buchhaltung';
END $$;
