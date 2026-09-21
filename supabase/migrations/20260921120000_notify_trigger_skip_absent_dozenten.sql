-- ============================================================================
-- TRIGGER FIX: treat dozent_absences like vacation in VB request notifications
-- ============================================================================
-- Problem: notify_dozenten_on_new_vb_request() only skipped dozenten with
-- vacation_start_date/end_date or vb_available = false. A dozent marked absent
-- in dozent_absences (e.g. sick leave via the absence calendar) was still
-- counted as "available regular dozent", so the Springer fallback never kicked
-- in and new Sachverhalt requests were notified to a dozent who is out sick.
--
-- Fix: a dozent with a dozent_absences row covering today counts as
-- unavailable — both in the regular_count calculation and in the notification
-- INSERT. This mirrors is_vb_dozent_available() (migration 20260915160000),
-- which already includes dozent_absences.
--
-- Note: the function is SECURITY DEFINER (runs as owner), so reading
-- dozent_absences here is fine even though non-admin dozenten cannot.

CREATE OR REPLACE FUNCTION public.notify_dozenten_on_new_vb_request()
RETURNS TRIGGER AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'Europe/Berlin')::date;
  regular_count INTEGER;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'requested') THEN
    -- Count regular (non-Springer) VB dozenten for this legal area that are
    -- currently available (toggle on, not on vacation, no absence today)
    SELECT COUNT(*) INTO regular_count
    FROM public.profiles p
    WHERE p.role = 'dozent'
      AND p.vb_legal_areas IS NOT NULL
      AND array_length(p.vb_legal_areas, 1) > 0
      AND NEW.legal_area = ANY (p.vb_legal_areas)
      AND COALESCE(p.vb_springer, false) = false
      AND COALESCE(p.vb_available, true) = true
      AND NOT (
        p.vacation_start_date IS NOT NULL
        AND p.vacation_end_date IS NOT NULL
        AND today >= p.vacation_start_date
        AND today <= p.vacation_end_date
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.dozent_absences da
        WHERE da.dozent_id = p.id
          AND da.start_date <= today
          AND da.end_date >= today
      );

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
      AND p.vb_legal_areas IS NOT NULL
      AND array_length(p.vb_legal_areas, 1) > 0
      AND NEW.legal_area = ANY (p.vb_legal_areas)
      -- available (toggle), not on vacation, and not absent today
      AND COALESCE(p.vb_available, true) = true
      AND NOT (
        p.vacation_start_date IS NOT NULL
        AND p.vacation_end_date IS NOT NULL
        AND today >= p.vacation_start_date
        AND today <= p.vacation_end_date
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.dozent_absences da
        WHERE da.dozent_id = p.id
          AND da.start_date <= today
          AND da.end_date >= today
      )
      -- skip dozenten with email notifications explicitly disabled
      AND COALESCE(p.email_notifications_enabled, true) = true
      -- regular dozenten if any is available, otherwise Springer dozenten
      AND (
        (regular_count > 0 AND COALESCE(p.vb_springer, false) = false)
        OR
        (regular_count = 0 AND COALESCE(p.vb_springer, false) = true)
      );

    RAISE LOG 'VB: Dozent notifications queued for new request % (%, %), regular available: %', NEW.id, NEW.legal_area, NEW.sub_area, regular_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_dozenten_on_new_vb_request() IS
  'Notifies available regular VB dozenten (by vb_legal_areas) on new VB request; falls back to Springer dozenten when no regular dozent for the legal area is available. Availability includes vb_available, vacation dates AND dozent_absences.';
