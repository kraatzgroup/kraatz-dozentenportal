-- Query to find dozent profiles WITHOUT email that have hours records
-- These are the problematic ones - they have data but no auth user
-- Run this in Supabase SQL Editor

-- Summary counts
SELECT 
  'Total Dozents without Email' as category,
  COUNT(*) as count
FROM profiles 
WHERE role = 'dozent' 
  AND (email IS NULL OR email = '')

UNION ALL

SELECT 
  'Dozents without Email WITH Hours Records' as category,
  COUNT(DISTINCT p.id) as count
FROM profiles p
WHERE p.role = 'dozent'
  AND (p.email IS NULL OR p.email = '')
  AND (
    EXISTS (SELECT 1 FROM dozent_hours WHERE dozent_id = p.id)
    OR EXISTS (SELECT 1 FROM participant_hours WHERE dozent_id = p.id)
    OR EXISTS (SELECT 1 FROM pending_dozent_hours WHERE dozent_id = p.id)
  )

UNION ALL

SELECT 
  'Dozents without Email WITHOUT Hours (Safe to Delete)' as category,
  COUNT(DISTINCT p.id) as count
FROM profiles p
WHERE p.role = 'dozent'
  AND (p.email IS NULL OR p.email = '')
  AND NOT EXISTS (SELECT 1 FROM dozent_hours WHERE dozent_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM participant_hours WHERE dozent_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM pending_dozent_hours WHERE dozent_id = p.id);

-- Detailed list of dozents WITHOUT email but WITH hours records
-- These need special handling - can't just delete them
SELECT 
  p.id,
  p.full_name,
  p.email,
  COALESCE(dh_count.count, 0) as dozent_hours_count,
  COALESCE(ph_count.count, 0) as participant_hours_count,
  COALESCE(pdh_count.count, 0) as pending_hours_count,
  COALESCE(dh_count.count, 0) + COALESCE(ph_count.count, 0) + COALESCE(pdh_count.count, 0) as total_hours_records,
  COALESCE(t_count.count, 0) as teilnehmer_count
FROM profiles p
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count 
  FROM dozent_hours 
  GROUP BY dozent_id
) dh_count ON dh_count.dozent_id = p.id
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count 
  FROM participant_hours 
  GROUP BY dozent_id
) ph_count ON ph_count.dozent_id = p.id
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count 
  FROM pending_dozent_hours 
  GROUP BY dozent_id
) pdh_count ON pdh_count.dozent_id = p.id
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count 
  FROM teilnehmer 
  GROUP BY dozent_id
) t_count ON t_count.dozent_id = p.id
WHERE p.role = 'dozent'
  AND (p.email IS NULL OR p.email = '')
  AND (
    COALESCE(dh_count.count, 0) + 
    COALESCE(ph_count.count, 0) + 
    COALESCE(pdh_count.count, 0)
  ) > 0
ORDER BY total_hours_records DESC;

-- List of dozents WITHOUT email and WITHOUT hours (safe to delete)
SELECT 
  p.id,
  p.full_name,
  p.email,
  COALESCE(t_count.count, 0) as teilnehmer_count
FROM profiles p
LEFT JOIN (
  SELECT dozent_id, COUNT(*) as count 
  FROM teilnehmer 
  GROUP BY dozent_id
) t_count ON t_count.dozent_id = p.id
WHERE p.role = 'dozent'
  AND (p.email IS NULL OR p.email = '')
  AND NOT EXISTS (SELECT 1 FROM dozent_hours WHERE dozent_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM participant_hours WHERE dozent_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM pending_dozent_hours WHERE dozent_id = p.id)
ORDER BY p.full_name;
