-- Find all dozent_id values that exist in hours tables
-- Run this in Supabase SQL Editor

-- All unique dozent_ids across all hours tables
SELECT DISTINCT 
  'dozent_hours' as source_table,
  dozent_id,
  p.full_name,
  p.email,
  COUNT(*) OVER (PARTITION BY dozent_id) as records_in_this_table
FROM dozent_hours dh
LEFT JOIN profiles p ON p.id = dh.dozent_id

UNION ALL

SELECT DISTINCT 
  'participant_hours' as source_table,
  dozent_id,
  p.full_name,
  p.email,
  COUNT(*) OVER (PARTITION BY dozent_id) as records_in_this_table
FROM participant_hours ph
LEFT JOIN profiles p ON p.id = ph.dozent_id

UNION ALL

SELECT DISTINCT 
  'pending_dozent_hours' as source_table,
  dozent_id,
  p.full_name,
  p.email,
  COUNT(*) OVER (PARTITION BY dozent_id) as records_in_this_table
FROM pending_dozent_hours pdh
LEFT JOIN profiles p ON p.id = pdh.dozent_id

ORDER BY dozent_id, source_table;

-- Summary: Unique dozent_ids across all tables
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

-- Count by status
SELECT 
  CASE 
    WHEN p.id IS NULL THEN '⚠️ ORPHANED (no profile exists)'
    WHEN p.email IS NULL OR p.email = '' THEN '⚠️ NO EMAIL'
    ELSE '✅ Has email'
  END as status,
  COUNT(DISTINCT all_dozent_ids.dozent_id) as count
FROM (
  SELECT DISTINCT dozent_id FROM dozent_hours
  UNION
  SELECT DISTINCT dozent_id FROM participant_hours
  UNION
  SELECT DISTINCT dozent_id FROM pending_dozent_hours
) all_dozent_ids
LEFT JOIN profiles p ON p.id = all_dozent_ids.dozent_id
GROUP BY status
ORDER BY count DESC;
