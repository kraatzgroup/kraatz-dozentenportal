/*
  # Fix invoice_number ambiguity in trigger function

  1. Changes
    - Rename the local variable from invoice_number to new_invoice_number
    - This eliminates the ambiguity between the column name and variable name
    - Keep all other logic exactly the same

  2. Security
    - No changes to RLS or policies
    - Function maintains same behavior
*/

-- Drop and recreate the function to fix the ambiguity
DROP FUNCTION IF EXISTS set_invoice_number() CASCADE;

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    date_part TEXT;
    new_invoice_number TEXT;
    max_sequence INTEGER;
BEGIN
    -- Generate date part in DDMMYYYY format
    date_part := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');
    
    -- Find the highest sequence number for today's date
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN invoice_number LIKE 'RE' || date_part || '%' 
                THEN CAST(RIGHT(invoice_number, 2) AS INTEGER)
                ELSE 0
            END
        ), 0
    ) INTO max_sequence
    FROM invoices;
    
    -- Generate new invoice number
    new_invoice_number := 'RE' || date_part || LPAD((max_sequence + 1)::TEXT, 2, '0');
    
    -- Set the invoice number
    NEW.invoice_number := new_invoice_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();