-- ============================================================================
-- VB WORKFLOW NOTIFICATION TRIGGERS
-- ============================================================================
-- This migration adds database triggers to automatically create notification
-- records at key workflow stages, making the notification system bulletproof
-- and independent of frontend implementation.
--
-- Workflow stages:
-- 1. requested -> materials_ready (dozent assigns materials) -> notify student
-- 2. materials_ready -> submitted (student submits work) -> notify dozent
-- 3. submitted -> under_review (dozent claims) -> no notification needed
-- 4. under_review -> corrected (dozent corrects) -> notify student
-- 5. corrected -> completed (dozent adds video) -> notify student
--
-- The triggers insert into vb_notifications table, which is then processed
-- by the existing vb-notify-student and vb-notify-dozent edge functions.

-- ============================================================================
-- TRIGGER FUNCTION: Notify Dozent on Student Submission
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_dozent_on_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status change to 'submitted' when dozent is assigned
  IF (TG_OP = 'UPDATE' 
      AND OLD.status IS DISTINCT FROM NEW.status 
      AND NEW.status = 'submitted'
      AND NEW.assigned_dozent_id IS NOT NULL) THEN
    
    -- Insert notification for dozent
    INSERT INTO public.vb_notifications (profile_id, title, message, type, related_case_study_id)
    VALUES (
      NEW.assigned_dozent_id,
      'Neue Bearbeitung eingereicht',
      'Ein Teilnehmer hat eine Bearbeitung für Klausur #' || COALESCE(NEW.case_study_number::text, '?') || ' eingereicht.',
      'info',
      NEW.id
    );
    
    RAISE LOG 'VB: Dozent notification queued for submission %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FUNCTION: Notify Student on Material Assignment
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_student_on_material_ready()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Only trigger on status change to 'materials_ready'
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'materials_ready') THEN
    -- Check if this is a material change (status was already materials_ready)
    IF OLD.status = 'materials_ready' THEN
      notification_title := 'Material geändert';
      notification_message := 'Das Ihnen für Klausur #' || COALESCE(NEW.case_study_number::text, '?') || ' zugewiesene Material hat sich geändert.';
    ELSE
      notification_title := 'Sachverhalt verfügbar';
      notification_message := 'Dein Sachverhalt für Klausur #' || COALESCE(NEW.case_study_number::text, '?') || ' ist jetzt verfügbar. Du kannst mit der Bearbeitung beginnen.';
    END IF;
    
    -- Insert notification for student
    INSERT INTO public.vb_notifications (profile_id, title, message, type, related_case_study_id)
    VALUES (
      NEW.profile_id,
      notification_title,
      notification_message,
      'success',
      NEW.id
    );
    
    RAISE LOG 'VB: Student notification queued for material ready %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FUNCTION: Notify Student on Correction Complete
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_student_on_correction_complete()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Only trigger on status change to 'corrected' or 'completed'
  IF (TG_OP = 'UPDATE' 
      AND OLD.status IS DISTINCT FROM NEW.status 
      AND (NEW.status = 'corrected' OR NEW.status = 'completed')) THEN
    
    -- Set notification based on status
    IF NEW.status = 'completed' THEN
      notification_title := 'Korrektur abgeschlossen';
      notification_message := 'Die Korrektur für Klausur #' || COALESCE(NEW.case_study_number::text, '?') || ' ist abgeschlossen. Eine neue Video-Klausurenkorrektur ist verfügbar.';
    ELSE
      notification_title := 'Korrektur verfügbar';
      notification_message := 'Die Korrektur für Klausur #' || COALESCE(NEW.case_study_number::text, '?') || ' ist verfügbar.';
    END IF;
    
    -- Insert notification for student
    INSERT INTO public.vb_notifications (profile_id, title, message, type, related_case_study_id)
    VALUES (
      NEW.profile_id,
      notification_title,
      notification_message,
      'success',
      NEW.id
    );
    
    RAISE LOG 'VB: Student notification queued for correction complete %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_notify_dozent_on_submission ON public.vb_case_study_requests;
DROP TRIGGER IF EXISTS trigger_notify_student_on_material_ready ON public.vb_case_study_requests;
DROP TRIGGER IF EXISTS trigger_notify_student_on_correction_complete ON public.vb_case_study_requests;

-- Create triggers
CREATE TRIGGER trigger_notify_dozent_on_submission
  AFTER UPDATE ON public.vb_case_study_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_dozent_on_submission();

CREATE TRIGGER trigger_notify_student_on_material_ready
  AFTER UPDATE ON public.vb_case_study_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_student_on_material_ready();

CREATE TRIGGER trigger_notify_student_on_correction_complete
  AFTER UPDATE ON public.vb_case_study_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_student_on_correction_complete();

-- ============================================================================
-- WEBHOOK TRIGGER FOR VB_NOTIFICATIONS
-- ============================================================================
-- Enable realtime for vb_notifications to trigger edge function calls
alter publication supabase_realtime add table vb_notifications;

-- ============================================================================
-- EDGE FUNCTION: Process VB Notifications
-- ============================================================================
-- This edge function is triggered by Supabase Realtime when a new notification
-- is inserted into vb_notifications. It calls the appropriate email notification
-- edge function (vb-notify-student or vb-notify-dozent) based on the notification type.

-- Note: The webhook configuration is done via Supabase Dashboard or CLI:
-- supabase functions deploy vb-process-notification
-- Then configure webhook in Supabase Dashboard: Database > Replication > Webhooks
-- Target: https://gkkveloqajxghhflkfru.supabase.co/functions/v1/vb-process-notification
-- Events: INSERT on vb_notifications

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION notify_dozent_on_submission() IS 'Automatically creates notification for dozent when student submits work (status -> submitted)';
COMMENT ON FUNCTION notify_student_on_material_ready() IS 'Automatically creates notification for student when dozent assigns materials (status -> materials_ready)';
COMMENT ON FUNCTION notify_student_on_correction_complete() IS 'Automatically creates notification for student when dozent completes correction (status -> corrected/completed)';
COMMENT ON TABLE vb_notifications IS 'Stores VB workflow notifications. Realtime enabled for webhook trigger to email edge functions.';
