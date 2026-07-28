-- VB chat bell notifications: notify conversation participants (except the
-- sender) about new chat messages via vb_notifications.

-- Link notifications to conversations so the bell can route to the chat
ALTER TABLE public.vb_notifications
ADD COLUMN IF NOT EXISTS related_conversation_id uuid REFERENCES public.vb_conversations(id) ON DELETE CASCADE;

-- Trigger function: create a bell notification for each participant except the sender
CREATE OR REPLACE FUNCTION public.notify_vb_chat_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sender_name text;
BEGIN
    SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO sender_name
    FROM public.profiles
    WHERE id = NEW.sender_id;

    IF sender_name IS NULL OR sender_name = '' THEN
        sender_name := 'Jemand';
    END IF;

    INSERT INTO public.vb_notifications (profile_id, title, message, type, related_conversation_id)
    SELECT
        cp.profile_id,
        'Neue Chat-Nachricht',
        sender_name || ': ' || LEFT(COALESCE(NEW.content, ''), 100),
        'info',
        NEW.conversation_id
    FROM public.vb_conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.profile_id <> NEW.sender_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_vb_chat_message ON public.vb_chat_messages;
CREATE TRIGGER trigger_notify_vb_chat_message
    AFTER INSERT ON public.vb_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_vb_chat_participants();
