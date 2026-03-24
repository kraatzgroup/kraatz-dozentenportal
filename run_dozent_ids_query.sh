#!/bin/bash

# Script to query dozent_ids in hours tables
# Make sure you have SUPABASE_DB_PASSWORD set in your environment

echo "Querying dozent_ids in hours tables..."
echo "========================================"

psql "postgresql://postgres.gkkveloqajxghhflkfru:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" << 'EOF'

-- Summary of all unique dozent_ids
SELECT 
  dozent_id,
  p.full_name,
  p.email,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN '⚠️ ORPHANED (no profile exists)'
    WHEN p.email IS NULL OR p.email = '' THEN '⚠️ NO EMAIL'
    ELSE '✅ Has email'
  END as status,
  COALESCE(dh.count, 0) as dozent_hours_count,
  COALESCE(ph.count, 0) as participant_hours_count,
  COALESCE(pdh.count, 0) as pending_hours_count,
  COALESCE(dh.count, 0) + COALESCE(ph.count, 0) + COALESCE(pdh.count, 0) as total_records
FROM (
  SELECT DISTINCT dozent_id FROM dozent_hours
  UNION
  SELECT DISTINCT dozent_id FROM participant_hours
  UNION
  SELECT DISTINCT dozent_id FROM pending_dozent_hours
) all_dozent_ids
LEFT JOIN profiles p ON p.id = all_dozent_ids.dozent_id
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count FROM dozent_hours GROUP BY dozent_id
) dh ON dh.dozent_id = all_dozent_ids.dozent_id
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count FROM participant_hours GROUP BY dozent_id
) ph ON ph.dozent_id = all_dozent_ids.dozent_id
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count FROM pending_dozent_hours GROUP BY dozent_id
) pdh ON pdh.dozent_id = all_dozent_ids.dozent_id
ORDER BY total_records DESC, p.full_name;

EOF
