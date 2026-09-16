-- ============================================================================
-- VB DOZENT AVAILABILITY RPC
-- ============================================================================
-- The student-side upload flow (VbCaseStudyDashboard) needs to know whether the
-- assigned dozent can actually take a submitted klausur. Availability includes
-- dozent_absences, which students cannot read due to RLS ("Dozenten manage own
-- absences": only dozent_id = auth.uid() or admin/vertrieb).
-- These SECURITY DEFINER functions expose a minimal availability check so the
-- frontend can hand submissions over to available springers without granting
-- table access to dozent_absences.
--
-- A dozent counts as unavailable when ANY of:
--   - vb_available = false (manually toggled off)
--   - email_notifications_enabled = false (Korrektur dashboard hides open work)
--   - vacation_start_date/end_date covers today
--   - a dozent_absences row covers today
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_vb_dozent_available(p_dozent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = p_dozent_id
      AND p.vb_available IS DISTINCT FROM false
      AND p.email_notifications_enabled IS DISTINCT FROM false
      AND NOT (
        p.vacation_start_date IS NOT NULL
        AND p.vacation_end_date IS NOT NULL
        AND CURRENT_DATE BETWEEN p.vacation_start_date AND p.vacation_end_date
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dozent_absences a
        WHERE a.dozent_id = p_dozent_id
          AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
      )
  );
$$;

-- All available dozenten covering a legal area (used to pick springers for a
-- handover). Returns only id + vb_springer; callers fetch contact details via
-- the normal profiles select.
CREATE OR REPLACE FUNCTION public.get_available_vb_dozenten(p_legal_area text)
RETURNS TABLE(id uuid, vb_springer boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.vb_springer
  FROM profiles p
  WHERE p.role = 'dozent'
    AND p.vb_legal_areas @> ARRAY[p_legal_area]::text[]
    AND public.is_vb_dozent_available(p.id);
$$;

GRANT EXECUTE ON FUNCTION public.is_vb_dozent_available(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_vb_dozenten(text) TO authenticated;

COMMENT ON FUNCTION public.is_vb_dozent_available(uuid) IS
  'Checks whether a VB dozent can take cases right now (vb_available, notifications, vacation, dozent_absences). SECURITY DEFINER because students cannot read dozent_absences.';
COMMENT ON FUNCTION public.get_available_vb_dozenten(text) IS
  'Lists available VB dozenten covering a legal area, for submission handover to springers.';
