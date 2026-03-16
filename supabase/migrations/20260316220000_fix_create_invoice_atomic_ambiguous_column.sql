-- Fix ambiguous column reference in create_invoice_atomic function
-- The issue is that created_at exists in multiple tables and needs explicit table prefix

CREATE OR REPLACE FUNCTION create_invoice_atomic(
  p_dozent_id uuid,
  p_month integer,
  p_year integer,
  p_period_start date,
  p_period_end date,
  p_total_amount numeric,
  p_status text,
  p_exam_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  invoice_number text,
  dozent_id uuid,
  month integer,
  year integer,
  period_start date,
  period_end date,
  total_amount numeric,
  status text,
  exam_type text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_number text;
  v_count integer;
  v_new_invoice_id uuid;
BEGIN
  -- Generate unique invoice number with exam type suffix if provided
  -- FIX: Use explicit table alias to avoid ambiguous column reference
  v_count := (
    SELECT COUNT(*) 
    FROM invoices i
    WHERE EXTRACT(MONTH FROM i.created_at) = p_month 
      AND EXTRACT(YEAR FROM i.created_at) = p_year
  );
  
  -- Format: RE{count}{month}{year} or RE{count}{month}{year}-2 for 2. Staatsexamen
  IF p_exam_type = '2. Staatsexamen' THEN
    v_invoice_number := 'RE' || LPAD((v_count + 1)::text, 2, '0') || LPAD(p_month::text, 2, '0') || p_year::text || '-2';
  ELSE
    v_invoice_number := 'RE' || LPAD((v_count + 1)::text, 2, '0') || LPAD(p_month::text, 2, '0') || p_year::text;
  END IF;
  
  -- Insert the invoice
  INSERT INTO invoices (
    invoice_number,
    dozent_id,
    month,
    year,
    period_start,
    period_end,
    total_amount,
    status,
    exam_type
  ) VALUES (
    v_invoice_number,
    p_dozent_id,
    p_month,
    p_year,
    p_period_start,
    p_period_end,
    p_total_amount,
    p_status,
    p_exam_type
  )
  RETURNING invoices.id INTO v_new_invoice_id;
  
  -- Return the created invoice
  RETURN QUERY
  SELECT 
    i.id,
    i.invoice_number,
    i.dozent_id,
    i.month,
    i.year,
    i.period_start,
    i.period_end,
    i.total_amount,
    i.status,
    i.exam_type,
    i.created_at,
    i.updated_at
  FROM invoices i
  WHERE i.id = v_new_invoice_id;
END;
$$;
