-- Query to check how many dozent profiles have associated hours records
-- Run this in Supabase SQL Editor

-- Summary: Count of dozents with hours
SELECT 
  'Total Dozents' as category,
  COUNT(*) as count
FROM profiles 
WHERE role = 'dozent'

UNION ALL

SELECT 
  'Dozents with ANY Hours Records' as category,
  COUNT(DISTINCT p.id) as count
FROM profiles p
WHERE p.role = 'dozent'
  AND (
    EXISTS (SELECT 1 FROM dozent_hours WHERE dozent_id = p.id)
    OR EXISTS (SELECT 1 FROM participant_hours WHERE dozent_id = p.id)
    OR EXISTS (SELECT 1 FROM pending_dozent_hours WHERE dozent_id = p.id)
  )

UNION ALL

SELECT 
  'Dozents with Dozent Hours' as category,
  COUNT(DISTINCT p.id) as count
FROM profiles p
WHERE p.role = 'dozent'
  AND EXISTS (SELECT 1 FROM dozent_hours WHERE dozent_id = p.id)

UNION ALL

SELECT 
  'Dozents with Participant Hours' as category,
  COUNT(DISTINCT p.id) as count
FROM profiles p
WHERE p.role = 'dozent'
  AND EXISTS (SELECT 1 FROM participant_hours WHERE dozent_id = p.id)

UNION ALL

SELECT 
  'Dozents with Pending Hours' as category,
  COUNT(DISTINCT p.id) as count
FROM profiles p
WHERE p.role = 'dozent'
  AND EXISTS (SELECT 1 FROM pending_dozent_hours WHERE dozent_id = p.id)

UNION ALL

SELECT 
  'Dozents WITHOUT Hours Records (Safe to Delete)' as category,
  COUNT(DISTINCT p.id) as count
FROM profiles p
WHERE p.role = 'dozent'
  AND NOT EXISTS (SELECT 1 FROM dozent_hours WHERE dozent_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM participant_hours WHERE dozent_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM pending_dozent_hours WHERE dozent_id = p.id);

-- Detailed breakdown by dozent
SELECT 
  p.id,
  p.full_name,
  p.email,
  COALESCE(dh_count.count, 0) as dozent_hours,
  COALESCE(ph_count.count, 0) as participant_hours,
  COALESCE(pdh_count.count, 0) as pending_hours,
  COALESCE(dh_count.count, 0) + COALESCE(ph_count.count, 0) + COALESCE(pdh_count.count, 0) as total_hours_records
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
WHERE p.role = 'dozent'
  AND (
    COALESCE(dh_count.count, 0) + 
    COALESCE(ph_count.count, 0) + 
    COALESCE(pdh_count.count, 0)
  ) > 0
ORDER BY total_hours_records DESC;
