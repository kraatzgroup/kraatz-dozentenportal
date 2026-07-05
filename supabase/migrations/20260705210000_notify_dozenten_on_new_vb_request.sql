-- ============================================================================
-- TRIGGER: Notify dozenten by legal area on new VB case study request
-- ============================================================================
-- When a student creates a new Sachverhalt (status 'requested'), notify every
-- DESIGNATED VB dozent whose vb_legal_areas covers the request's legal_area.
--
-- Only dozenten with an explicitly set vb_legal_areas are notified (no fallback
-- to general legal_areas) so that only the designated VB correction dozenten
-- receive emails.
--
-- Dozenten on vacation or with email notifications disabled are skipped.
-- The inserted vb_notifications rows are turned into emails by the existing
-- notification pipeline (vb-notify-dozent).

CREATE OR REPLACE FUNCTION notify_dozenten_on_new_vb_request()
RETURNS TRIGGER AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'requested') THEN
    INSERT INTO public.vb_notifications (profile_id, title, message, type, related_case_study_id, created_at)
    SELECT
      p.id,
      'Neuer Sachverhalt angefordert',
      'Ein neuer Sachverhalt wurde angefordert: Klausur #'
        || COALESCE(NEW.case_study_number::text, '?')
        || ' - ' || NEW.legal_area
        || ' (' || COALESCE(NEW.sub_area, '-') || ')',
      'info',
      NEW.id,
      now()
    FROM public.profiles p
    WHERE p.role = 'dozent'
      -- only notify DESIGNATED VB dozenten: vb_legal_areas must be explicitly set
      -- (no fallback to general legal_areas)
      AND p.vb_legal_areas IS NOT NULL
      AND array_length(p.vb_legal_areas, 1) > 0
      AND NEW.legal_area = ANY (p.vb_legal_areas)
      -- skip dozenten with email notifications explicitly disabled
      AND COALESCE(p.email_notifications_enabled, true) = true
      -- skip dozenten currently on vacation
      AND NOT (
        p.vacation_start_date IS NOT NULL
        AND p.vacation_end_date IS NOT NULL
        AND today >= p.vacation_start_date
        AND today <= p.vacation_end_date
      );

    RAISE LOG 'VB: Dozent notifications queued for new request % (%, %)', NEW.id, NEW.legal_area, NEW.sub_area;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_dozenten_on_new_vb_request ON public.vb_case_study_requests;

CREATE TRIGGER trigger_notify_dozenten_on_new_vb_request
  AFTER INSERT ON public.vb_case_study_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_dozenten_on_new_vb_request();

COMMENT ON FUNCTION notify_dozenten_on_new_vb_request() IS 'Notifies dozenten (by effective VB legal areas, skipping vacation/opted-out) when a new VB case study request is created with status requested.';
