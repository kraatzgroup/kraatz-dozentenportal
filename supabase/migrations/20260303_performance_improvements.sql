-- Migration: Performance Improvements
-- Date: 2026-03-03
-- Purpose: Add missing indexes, optimize queries, and improve database performance

-- ============================================================================
-- PART 1: Missing Indexes for Foreign Keys and Frequently Queried Columns
-- ============================================================================

-- Messages table - heavily queried for chat functionality
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at);

-- Invoices - frequently filtered by status and date
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_sent_at ON invoices(sent_at) WHERE sent_at IS NOT NULL;

-- Files table - queried by folder, month, year, and download status
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- Folders table - queried by user
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- Material folders - queried by user
CREATE INDEX IF NOT EXISTS idx_material_folders_user_id ON material_folders(user_id);

-- Teaching materials - queried by user and folder
CREATE INDEX IF NOT EXISTS idx_teaching_materials_user_id ON teaching_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_teaching_materials_folder_id ON teaching_materials(folder_id);
CREATE INDEX IF NOT EXISTS idx_teaching_materials_created_at ON teaching_materials(created_at DESC);

-- Dozent hours - composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_dozent_hours_category ON dozent_hours(category);

-- Stundenzettel - queried by dozent and date
CREATE INDEX IF NOT EXISTS idx_stundenzettel_dozent_id ON stundenzettel(dozent_id);
CREATE INDEX IF NOT EXISTS idx_stundenzettel_date ON stundenzettel(date);
CREATE INDEX IF NOT EXISTS idx_stundenzettel_dozent_date ON stundenzettel(dozent_id, date DESC);

-- Calendar entries - queried by date and user
CREATE INDEX IF NOT EXISTS idx_calendar_entries_entry_date ON calendar_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_created_by ON calendar_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_date_user ON calendar_entries(entry_date, created_by);

-- Elite Kleingruppe tables
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_dozenten_legal_area ON elite_kleingruppe_dozenten(legal_area);
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_klausuren_teilnehmer ON elite_kleingruppe_klausuren(teilnehmer_id);
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_klausuren_date ON elite_kleingruppe_klausuren(date DESC);
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_releases_release_date ON elite_kleingruppe_releases(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_releases_legal_area ON elite_kleingruppe_releases(legal_area);
CREATE INDEX IF NOT EXISTS idx_elite_kleingruppe_releases_solutions ON elite_kleingruppe_releases(solutions_released);

-- Lead management - frequently filtered by status and dates
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes(created_at DESC);

-- Contract requests - queried by status and dates
CREATE INDEX IF NOT EXISTS idx_contract_requests_status ON contract_requests(status);
CREATE INDEX IF NOT EXISTS idx_contract_requests_requested_at ON contract_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_requests_lead_id ON contract_requests(lead_id);

-- Follow-ups - frequently queried by date and status
CREATE INDEX IF NOT EXISTS idx_follow_ups_vertrieb_user_id ON follow_ups(vertrieb_user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_teilnehmer ON follow_ups(lead_id, teilnehmer_id);

-- Sales calls - queried by vertrieb user
CREATE INDEX IF NOT EXISTS idx_sales_calls_vertrieb ON sales_calls(vertrieb_user_id);

-- Upsells - queried by teilnehmer
CREATE INDEX IF NOT EXISTS idx_upsells_teilnehmer_id ON upsells(teilnehmer_id);
CREATE INDEX IF NOT EXISTS idx_upsells_created_at ON upsells(created_at DESC);

-- Packages - active packages frequently queried
CREATE INDEX IF NOT EXISTS idx_packages_is_active ON packages(is_active) WHERE is_active = true;

-- Probestunden - queried by dozent and date
CREATE INDEX IF NOT EXISTS idx_probestunden_dozent_id ON probestunden(dozent_id);
CREATE INDEX IF NOT EXISTS idx_probestunden_date ON probestunden(date DESC);

-- Dozent availability - queried by dozent and day
CREATE INDEX IF NOT EXISTS idx_dozent_availability_day ON dozent_availability(day_of_week);

-- ============================================================================
-- PART 2: Partial Indexes for Common Filters
-- ============================================================================

-- Active teilnehmer (excluding inactive)
CREATE INDEX IF NOT EXISTS idx_teilnehmer_active ON teilnehmer(dozent_id, active_since) 
  WHERE active_since IS NOT NULL;

-- Pending trial lessons
CREATE INDEX IF NOT EXISTS idx_trial_lessons_pending ON trial_lessons(scheduled_date) 
  WHERE status = 'pending';

-- Pending follow-ups
CREATE INDEX IF NOT EXISTS idx_follow_ups_pending ON follow_ups(follow_up_date) 
  WHERE status = 'pending';

-- Unpaid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid ON invoices(dozent_id, created_at) 
  WHERE status != 'paid';

-- Active sales todos
CREATE INDEX IF NOT EXISTS idx_sales_todos_active ON sales_todos(scheduled_date, todo_type) 
  WHERE status = 'pending' OR status = 'in_progress';

-- ============================================================================
-- PART 3: Composite Indexes for Common Query Patterns
-- ============================================================================

-- Messages: Conversation lookup (both directions)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_reverse ON messages(receiver_id, sender_id, created_at);

-- Participant hours: Summary queries by dozent and date range
CREATE INDEX IF NOT EXISTS idx_participant_hours_summary ON participant_hours(dozent_id, date DESC, hours);

-- Files: Month/year assignment queries
CREATE INDEX IF NOT EXISTS idx_files_month_year_user ON files(user_id, assigned_year DESC, assigned_month DESC);

-- Leads: Status and assignment queries
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON leads(status, assigned_to, created_at DESC);

-- Elite releases: Legal area and date queries
CREATE INDEX IF NOT EXISTS idx_elite_releases_area_date ON elite_kleingruppe_releases(legal_area, release_date DESC);

-- ============================================================================
-- PART 4: Optimize Existing Tables
-- ============================================================================

-- Add FILLFACTOR to frequently updated tables to reduce page splits
ALTER TABLE messages SET (fillfactor = 90);
ALTER TABLE participant_hours SET (fillfactor = 90);
ALTER TABLE dozent_hours SET (fillfactor = 90);
ALTER TABLE invoices SET (fillfactor = 90);
ALTER TABLE sales_todos SET (fillfactor = 90);

-- ============================================================================
-- PART 5: Statistics and Maintenance
-- ============================================================================

-- Update statistics for better query planning
ANALYZE messages;
ANALYZE participant_hours;
ANALYZE dozent_hours;
ANALYZE invoices;
ANALYZE files;
ANALYZE teilnehmer;
ANALYZE leads;
ANALYZE elite_kleingruppe_releases;

-- ============================================================================
-- PART 6: Add Helpful Database Comments
-- ============================================================================

COMMENT ON INDEX idx_messages_conversation IS 
'Optimizes chat conversation queries between two users';

COMMENT ON INDEX idx_messages_read_at IS 
'Partial index for unread messages - improves notification queries';

COMMENT ON INDEX idx_participant_hours_summary IS 
'Composite index for monthly summary calculations';

COMMENT ON INDEX idx_invoices_unpaid IS 
'Partial index for unpaid invoices - improves dashboard queries';

COMMENT ON INDEX idx_files_month_year_user IS 
'Composite index for file segmentation by month/year';

-- ============================================================================
-- PART 7: Create Materialized View for Dashboard KPIs (Optional)
-- ============================================================================

-- This can be refreshed periodically for fast dashboard loading
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_kpis AS
SELECT 
  'total_dozenten' as metric,
  COUNT(*)::text as value,
  NOW() as last_updated
FROM profiles WHERE role = 'dozent'
UNION ALL
SELECT 
  'total_teilnehmer' as metric,
  COUNT(*)::text as value,
  NOW() as last_updated
FROM teilnehmer
UNION ALL
SELECT 
  'active_leads' as metric,
  COUNT(*)::text as value,
  NOW() as last_updated
FROM leads WHERE status IN ('new', 'contacted', 'qualified')
UNION ALL
SELECT 
  'pending_invoices' as metric,
  COUNT(*)::text as value,
  NOW() as last_updated
FROM invoices WHERE status != 'paid';

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_kpis_metric ON dashboard_kpis(metric);

-- Grant access
GRANT SELECT ON dashboard_kpis TO authenticated;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_kpis()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_kpis;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_dashboard_kpis() TO authenticated;

COMMENT ON MATERIALIZED VIEW dashboard_kpis IS 
'Cached dashboard metrics - refresh with SELECT refresh_dashboard_kpis()';

-- ============================================================================
-- PART 8: Performance Monitoring Views
-- ============================================================================

-- View to monitor slow queries (admin only)
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- queries taking more than 100ms on average
ORDER BY mean_exec_time DESC
LIMIT 50;

COMMENT ON VIEW slow_queries IS 
'Monitors queries with mean execution time > 100ms - requires pg_stat_statements extension';

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Performance Improvements Applied:';
  RAISE NOTICE '- Added 50+ indexes for frequently queried columns';
  RAISE NOTICE '- Created partial indexes for common filters';
  RAISE NOTICE '- Added composite indexes for complex queries';
  RAISE NOTICE '- Optimized table fillfactor for frequently updated tables';
  RAISE NOTICE '- Created materialized view for dashboard KPIs';
  RAISE NOTICE '- Updated table statistics for better query planning';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Monitor query performance with EXPLAIN ANALYZE';
  RAISE NOTICE '2. Refresh dashboard KPIs: SELECT refresh_dashboard_kpis();';
  RAISE NOTICE '3. Schedule periodic VACUUM and ANALYZE';
  RAISE NOTICE '=================================================================';
END $$;
