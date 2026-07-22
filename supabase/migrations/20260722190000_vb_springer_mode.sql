-- ============================================================================
-- VB SPRINGER MODE
-- ============================================================================
-- 1. profiles.vb_available: VB dozent toggles whether they can currently take
--    new Videoklausurenkorrektur cases (header toggle in /klausurenbesprechung/korrektur).
-- 2. profiles.vb_springer: marks a VB dozent as "Springer" (backup). A Springer
--    only receives new Sachverhalt requests for a legal area if NO regular
--    (non-Springer) VB dozent covering that area is currently available.
-- 3. Updated notification trigger: notify available regular dozenten per legal
--    area; if none is available, fall back to available Springer dozenten.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vb_springer BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vb_available BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.vb_springer IS 'VB Springer (backup dozent): only receives new VB requests for a legal area when no regular VB dozent for that area is available.';
COMMENT ON COLUMN public.profiles.vb_available IS 'Whether the VB dozent is currently available for new Videoklausurenkorrektur cases (header toggle).';

-- Designate the initial Springer user
UPDATE public.profiles
SET vb_springer = true
WHERE email = 'xa1gs9370e@yzcalo.com';

-- ============================================================================
-- Updated trigger: notify regular dozenten if available, else Springer
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_dozenten_on_new_vb_request()
RETURNS TRIGGER AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'Europe/Berlin')::date;
  regular_count INTEGER;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'requested') THEN
    -- Count regular (non-Springer) VB dozenten for this legal area that are
    -- currently available (toggle on, not on vacation)
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
      -- available (toggle) and not on vacation
      AND COALESCE(p.vb_available, true) = true
      AND NOT (
        p.vacation_start_date IS NOT NULL
        AND p.vacation_end_date IS NOT NULL
        AND today >= p.vacation_start_date
        AND today <= p.vacation_end_date
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

COMMENT ON FUNCTION notify_dozenten_on_new_vb_request() IS 'Notifies available regular VB dozenten (by vb_legal_areas) on new VB request; falls back to Springer dozenten when no regular dozent for the legal area is available.';
