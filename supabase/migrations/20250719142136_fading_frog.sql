/*
  # Add invoice system with extended profiles and invoices table

  1. New Profile Fields
    - Add phone, tax_id, bank_name, iban, bic to profiles table
    
  2. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique, auto-generated)
      - `dozent_id` (uuid, foreign key to profiles)
      - `month` (integer, 1-12)
      - `year` (integer)
      - `period_start` (date)
      - `period_end` (date)
      - `total_amount` (numeric)
      - `status` (text, enum: draft, sent, paid)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `sent_at` (timestamp, nullable)
      - `paid_at` (timestamp, nullable)
      
  3. Security
    - Enable RLS on invoices table
    - Add policies for dozents and admins
*/

-- Add new fields to profiles table
DO $$
BEGIN
  -- Add phone field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text DEFAULT '';
  END IF;
  
  -- Add tax_id field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tax_id text DEFAULT '';
  END IF;
  
  -- Add bank_name field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bank_name text DEFAULT '';
  END IF;
  
  -- Add iban field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'iban'
  ) THEN
    ALTER TABLE profiles ADD COLUMN iban text DEFAULT '';
  END IF;
  
  -- Add bic field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bic'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bic text DEFAULT '';
  END IF;
END $$;

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  dozent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  paid_at timestamptz
);

-- Create indexes for invoices table
CREATE INDEX IF NOT EXISTS idx_invoices_dozent_id ON invoices(dozent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_month_year ON invoices(month, year);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Create unique constraint for dozent/month/year combination
CREATE UNIQUE INDEX IF NOT EXISTS invoices_dozent_month_year_unique 
ON invoices(dozent_id, month, year);

-- Enable RLS on invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices table

-- Dozents can view their own invoices
CREATE POLICY "Dozents can view their own invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (dozent_id = auth.uid());

-- Dozents can create their own invoices
CREATE POLICY "Dozents can create their own invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (dozent_id = auth.uid());

-- Dozents can update their own draft invoices
CREATE POLICY "Dozents can update their own draft invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (dozent_id = auth.uid() AND status = 'draft')
  WITH CHECK (dozent_id = auth.uid());

-- Dozents can delete their own draft invoices
CREATE POLICY "Dozents can delete their own draft invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (dozent_id = auth.uid() AND status = 'draft');

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update all invoices
CREATE POLICY "Admins can update all invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can delete all invoices
CREATE POLICY "Admins can delete all invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  current_year text;
  next_number integer;
  invoice_number text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Get the next number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^RE-' || current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(invoice_number FROM '^RE-' || current_year || '-([0-9]+)$') AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM invoices;
  
  -- Format: RE-YYYY-NNNN (e.g., RE-2025-0001)
  invoice_number := 'RE-' || current_year || '-' || LPAD(next_number::text, 4, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice numbers on insert
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON invoices;
CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on invoices
DROP TRIGGER IF EXISTS update_invoices_updated_at_trigger ON invoices;
CREATE TRIGGER update_invoices_updated_at_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();