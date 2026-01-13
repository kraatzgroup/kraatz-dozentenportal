-- Fix SECURITY DEFINER views to use SECURITY INVOKER
-- This ensures RLS policies are enforced based on the querying user, not the view creator

-- Recreate participant_hours_with_names view with SECURITY INVOKER
DROP VIEW IF EXISTS participant_hours_with_names;
CREATE VIEW participant_hours_with_names 
WITH (security_invoker = true) AS
SELECT 
  ph.*,
  t.name as teilnehmer_name,
  p.full_name as dozent_name
FROM participant_hours ph
LEFT JOIN teilnehmer t ON ph.teilnehmer_id = t.id
LEFT JOIN profiles p ON ph.dozent_id = p.id;

GRANT SELECT ON participant_hours_with_names TO authenticated;

-- Recreate current_month_document_status view with SECURITY INVOKER
DROP VIEW IF EXISTS current_month_document_status;
CREATE VIEW current_month_document_status 
WITH (security_invoker = true) AS
SELECT * FROM get_monthly_document_status();

GRANT SELECT ON current_month_document_status TO authenticated;
