-- Migration: Add Email Notification for Klausur Submissions
-- Date: 2026-03-10
-- Purpose: Send email notification to dozent when a klausur is submitted

-- Function to send email notification when klausur is inserted
CREATE OR REPLACE FUNCTION notify_dozent_of_klausur()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_dozent_email TEXT;
  v_dozent_name TEXT;
  v_teilnehmer_name TEXT;
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
BEGIN
  -- Only send notification if dozent_id is set
  IF NEW.dozent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get dozent information
  SELECT email, full_name INTO v_dozent_email, v_dozent_name
  FROM profiles
  WHERE id = NEW.dozent_id;

  -- Get teilnehmer information
  SELECT 
    COALESCE(p.full_name, t.first_name || ' ' || t.last_name) INTO v_teilnehmer_name
  FROM teilnehmer t
  LEFT JOIN profiles p ON t.profile_id = p.id
  WHERE t.id = NEW.teilnehmer_id;

  -- Only proceed if we have all required information
  IF v_dozent_email IS NULL OR v_dozent_name IS NULL OR v_teilnehmer_name IS NULL THEN
    RAISE WARNING 'Missing information for klausur notification: dozent_email=%, dozent_name=%, teilnehmer_name=%', 
      v_dozent_email, v_dozent_name, v_teilnehmer_name;
    RETURN NEW;
  END IF;

  -- Get Supabase URL from environment (set via dashboard)
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- If not set via settings, use default
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://gkkveloqajxghhflkfru.supabase.co';
  END IF;

  -- Call edge function to send email (async, don't wait for response)
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/klausur-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'dozentEmail', v_dozent_email,
      'dozentName', v_dozent_name,
      'teilnehmerName', v_teilnehmer_name,
      'klausurTitle', NEW.title,
      'legalArea', NEW.legal_area,
      'dozentId', NEW.dozent_id::text
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Error sending klausur notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to send notification after klausur is inserted
DROP TRIGGER IF EXISTS trigger_notify_dozent_of_klausur ON elite_kleingruppe_klausuren;
CREATE TRIGGER trigger_notify_dozent_of_klausur
  AFTER INSERT ON elite_kleingruppe_klausuren
  FOR EACH ROW
  EXECUTE FUNCTION notify_dozent_of_klausur();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION notify_dozent_of_klausur() TO authenticated;

COMMENT ON FUNCTION notify_dozent_of_klausur() IS 
'Trigger function that sends an email notification to the assigned dozent when a new klausur is submitted';
