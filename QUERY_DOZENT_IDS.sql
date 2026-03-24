-- Copy and paste this into Supabase SQL Editor
-- This will show all dozent_ids that exist in hours tables

SELECT 
  dozent_id,
  p.full_name,
  p.email,
  CASE 
    WHEN p.id IS NULL THEN 'ORPHANED - no profile'
    WHEN p.email IS NULL OR p.email = '' THEN 'NO EMAIL'
    ELSE 'Has email'
  END as status,
  COALESCE(dh.count, 0) as dozent_hours,
  COALESCE(ph.count, 0) as participant_hours,
  COALESCE(pdh.count, 0) as pending_hours,
  COALESCE(dh.count, 0) + COALESCE(ph.count, 0) + COALESCE(pdh.count, 0) as total
FROM (
  SELECT DISTINCT dozent_id FROM dozent_hours
  UNION
  SELECT DISTINCT dozent_id FROM participant_hours
  UNION
  SELECT DISTINCT dozent_id FROM pending_dozent_hours
) all_ids
LEFT JOIN profiles p ON p.id = all_ids.dozent_id
LEFT JOIN (SELECT dozent_id, COUNT(*) as count FROM dozent_hours GROUP BY dozent_id) dh ON dh.dozent_id = all_ids.dozent_id
LEFT JOIN (SELECT dozent_id, COUNT(*) as count FROM participant_hours GROUP BY dozent_id) ph ON ph.dozent_id = all_ids.dozent_id
LEFT JOIN (SELECT dozent_id, COUNT(*) as count FROM pending_dozent_hours GROUP BY dozent_id) pdh ON pdh.dozent_id = all_ids.dozent_id
ORDER BY total DESC;
