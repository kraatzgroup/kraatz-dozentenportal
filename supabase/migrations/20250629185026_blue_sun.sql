/*
  # Monthly Document Check System

  1. Functions
    - `is_fifth_of_month()` - Helper to check if today is the 5th
    - `get_previous_month_info()` - Get previous month details
    - `check_dozent_documents()` - Check documents for a specific dozent
    - `get_monthly_document_status()` - Get status for all dozenten
    - `trigger_monthly_document_check()` - Main function to trigger the check

  2. Security
    - Functions are security definer with proper permissions
    - Only authenticated users can execute functions

  3. Notes
    - No pg_cron dependency (not available in Supabase)
    - Can be triggered manually or via scheduled application calls
    - Integrates with existing edge functions for email notifications
*/

-- Helper function to check if today is the 5th of the month
CREATE OR REPLACE FUNCTION is_fifth_of_month()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXTRACT(DAY FROM CURRENT_DATE) = 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get previous month information
CREATE OR REPLACE FUNCTION get_previous_month_info()
RETURNS TABLE(month_number INTEGER, year_number INTEGER, month_name TEXT) AS $$
DECLARE
  prev_month INTEGER;
  prev_year INTEGER;
  month_names TEXT[] := ARRAY['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                              'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
BEGIN
  -- Calculate previous month
  prev_month := EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month');
  prev_year := EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month');
  
  RETURN QUERY SELECT 
    prev_month,
    prev_year,
    month_names[prev_month];
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check documents for a specific dozent
CREATE OR REPLACE FUNCTION check_dozent_documents(dozent_id UUID, check_month INTEGER, check_year INTEGER)
RETURNS TABLE(
  category TEXT,
  file_count INTEGER,
  has_documents BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH required_categories AS (
    SELECT unnest(ARRAY['Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer']) AS category_name
  ),
  document_counts AS (
    SELECT 
      f.name AS folder_name,
      COUNT(files.id) AS file_count
    FROM folders f
    LEFT JOIN files ON files.folder_id = f.id 
      AND files.assigned_month = check_month 
      AND files.assigned_year = check_year
    WHERE f.user_id = dozent_id 
      AND f.name IN ('Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer')
    GROUP BY f.name
  )
  SELECT 
    rc.category_name,
    COALESCE(dc.file_count, 0)::INTEGER,
    COALESCE(dc.file_count, 0) > 0
  FROM required_categories rc
  LEFT JOIN document_counts dc ON rc.category_name = dc.folder_name
  ORDER BY rc.category_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get monthly document status for all dozenten
CREATE OR REPLACE FUNCTION get_monthly_document_status(check_month INTEGER DEFAULT NULL, check_year INTEGER DEFAULT NULL)
RETURNS TABLE(
  dozent_id UUID,
  dozent_name TEXT,
  dozent_email TEXT,
  total_categories INTEGER,
  completed_categories INTEGER,
  missing_categories INTEGER,
  is_complete BOOLEAN,
  category_details JSONB
) AS $$
DECLARE
  target_month INTEGER;
  target_year INTEGER;
  prev_month_info RECORD;
BEGIN
  -- Use provided month/year or default to previous month
  IF check_month IS NULL OR check_year IS NULL THEN
    SELECT * INTO prev_month_info FROM get_previous_month_info();
    target_month := prev_month_info.month_number;
    target_year := prev_month_info.year_number;
  ELSE
    target_month := check_month;
    target_year := check_year;
  END IF;

  RETURN QUERY
  WITH dozent_status AS (
    SELECT 
      p.id,
      p.full_name,
      p.email,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'category', cdd.category,
            'file_count', cdd.file_count,
            'has_documents', cdd.has_documents
          )
        )
        FROM check_dozent_documents(p.id, target_month, target_year) cdd
      ) AS details
    FROM profiles p
    WHERE p.role = 'dozent'
  )
  SELECT 
    ds.id,
    ds.full_name,
    ds.email,
    3 AS total_categories, -- Always 3 required categories
    (
      SELECT COUNT(*)::INTEGER 
      FROM jsonb_array_elements(ds.details) AS elem
      WHERE (elem->>'has_documents')::BOOLEAN = true
    ) AS completed_categories,
    (
      SELECT COUNT(*)::INTEGER 
      FROM jsonb_array_elements(ds.details) AS elem
      WHERE (elem->>'has_documents')::BOOLEAN = false
    ) AS missing_categories,
    (
      SELECT COUNT(*) = 3
      FROM jsonb_array_elements(ds.details) AS elem
      WHERE (elem->>'has_documents')::BOOLEAN = true
    ) AS is_complete,
    ds.details
  FROM dozent_status ds
  ORDER BY ds.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main function to trigger monthly document check
CREATE OR REPLACE FUNCTION trigger_monthly_document_check(force_check BOOLEAN DEFAULT false)
RETURNS TABLE(
  execution_date DATE,
  is_deadline_day BOOLEAN,
  check_executed BOOLEAN,
  total_dozenten INTEGER,
  complete_submissions INTEGER,
  incomplete_submissions INTEGER,
  check_month INTEGER,
  check_year INTEGER,
  month_name TEXT,
  summary JSONB
) AS $$
DECLARE
  is_deadline BOOLEAN;
  prev_month_info RECORD;
  status_summary JSONB;
  total_count INTEGER := 0;
  complete_count INTEGER := 0;
  incomplete_count INTEGER := 0;
BEGIN
  -- Get previous month info
  SELECT * INTO prev_month_info FROM get_previous_month_info();
  
  -- Check if today is the deadline (5th of month)
  is_deadline := is_fifth_of_month();
  
  -- Only execute check if it's the deadline day or forced
  IF NOT (is_deadline OR force_check) THEN
    RETURN QUERY SELECT 
      CURRENT_DATE,
      is_deadline,
      false, -- check_executed
      0, 0, 0, -- counts
      prev_month_info.month_number,
      prev_month_info.year_number,
      prev_month_info.month_name,
      jsonb_build_object(
        'message', 'Check skipped - not deadline day and not forced',
        'next_deadline', (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '4 days')::DATE
      );
    RETURN;
  END IF;

  -- Get document status for all dozenten
  SELECT jsonb_agg(
    jsonb_build_object(
      'dozent_id', gms.dozent_id,
      'dozent_name', gms.dozent_name,
      'dozent_email', gms.dozent_email,
      'is_complete', gms.is_complete,
      'completed_categories', gms.completed_categories,
      'missing_categories', gms.missing_categories,
      'category_details', gms.category_details
    )
  ) INTO status_summary
  FROM get_monthly_document_status(prev_month_info.month_number, prev_month_info.year_number) gms;

  -- Count totals
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE (elem->>'is_complete')::BOOLEAN = true),
    COUNT(*) FILTER (WHERE (elem->>'is_complete')::BOOLEAN = false)
  INTO total_count, complete_count, incomplete_count
  FROM jsonb_array_elements(status_summary) AS elem;

  -- Log the execution
  RAISE LOG 'Monthly document check executed on % for %/% - Total: %, Complete: %, Incomplete: %', 
    CURRENT_DATE, prev_month_info.month_name, prev_month_info.year_number, 
    total_count, complete_count, incomplete_count;

  RETURN QUERY SELECT 
    CURRENT_DATE,
    is_deadline,
    true, -- check_executed
    total_count,
    complete_count,
    incomplete_count,
    prev_month_info.month_number,
    prev_month_info.year_number,
    prev_month_info.month_name,
    jsonb_build_object(
      'execution_type', CASE WHEN force_check THEN 'manual' ELSE 'scheduled' END,
      'deadline_day', is_deadline,
      'dozenten_status', status_summary,
      'statistics', jsonb_build_object(
        'total', total_count,
        'complete', complete_count,
        'incomplete', incomplete_count,
        'completion_rate', CASE WHEN total_count > 0 THEN ROUND((complete_count::DECIMAL / total_count) * 100, 1) ELSE 0 END
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next deadline date
CREATE OR REPLACE FUNCTION get_next_deadline()
RETURNS DATE AS $$
BEGIN
  -- Next deadline is the 5th of next month
  RETURN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '4 days')::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if we're past deadline for current month
CREATE OR REPLACE FUNCTION is_past_deadline()
RETURNS BOOLEAN AS $$
BEGIN
  -- Past deadline if today is after the 5th of current month
  RETURN EXTRACT(DAY FROM CURRENT_DATE) > 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_fifth_of_month() TO authenticated;
GRANT EXECUTE ON FUNCTION get_previous_month_info() TO authenticated;
GRANT EXECUTE ON FUNCTION check_dozent_documents(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_document_status(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_monthly_document_check(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_deadline() TO authenticated;
GRANT EXECUTE ON FUNCTION is_past_deadline() TO authenticated;

-- Create a view for easy access to current month status
CREATE OR REPLACE VIEW current_month_document_status AS
SELECT * FROM get_monthly_document_status();

-- Grant access to the view
GRANT SELECT ON current_month_document_status TO authenticated;

-- Log the setup completion
DO $$
DECLARE
  next_deadline DATE;
  prev_month_info RECORD;
BEGIN
  SELECT * INTO prev_month_info FROM get_previous_month_info();
  SELECT get_next_deadline() INTO next_deadline;
  
  RAISE NOTICE 'Monthly document check system has been set up:';
  RAISE NOTICE '- Current check period: % %', prev_month_info.month_name, prev_month_info.year_number;
  RAISE NOTICE '- Next deadline: %', next_deadline;
  RAISE NOTICE '- Manual trigger: SELECT * FROM trigger_monthly_document_check(true);';
  RAISE NOTICE '- View current status: SELECT * FROM current_month_document_status;';
  RAISE NOTICE '- Integration with edge function: check-monthly-documents';
END $$;