-- Fix VB chat: RLS infinite recursion + missing message columns + teilnehmer send rules
--
-- 1. vb_conversation_participants SELECT policy referenced the table itself
--    -> "infinite recursion detected in policy" (42P17). Fixed via a
--    SECURITY DEFINER helper that bypasses RLS for the membership check.
-- 2. vb_chat_messages was missing columns the frontend uses
--    (is_deleted, attachment_*).
-- 3. Teilnehmer messaging rule in dozent ('group') conversations:
--    a teilnehmer may only send if the last message is from someone else
--    (reply) or their own last message is within a 7-day window.
--    Support conversations ('support' type, with admin/verwaltung) are exempt.

-- ============================================================================
-- 1. Missing columns on vb_chat_messages
-- ============================================================================
ALTER TABLE public.vb_chat_messages
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS attachment_url TEXT,
    ADD COLUMN IF NOT EXISTS attachment_name TEXT,
    ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
    ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- ============================================================================
-- 2. Security definer helpers (break RLS recursion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_vb_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.vb_conversation_participants
        WHERE conversation_id = conv_id
        AND profile_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_vb_teilnehmer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'teilnehmer'
        AND 'videobesprechung' = ANY(additional_roles)
    );
$function$;

-- Teilnehmer send rule: in non-support conversations, a teilnehmer may send
-- only as a reply (last message from someone else) or within 7 days of the
-- last message. Dozent/admin/verwaltung are unrestricted.
CREATE OR REPLACE FUNCTION public.vb_can_send_message(conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    conv_type text;
    last_sender uuid;
    last_created timestamptz;
BEGIN
    IF NOT public.is_vb_teilnehmer() THEN
        RETURN true;
    END IF;

    SELECT type INTO conv_type
    FROM public.vb_conversations
    WHERE id = conv_id;

    IF conv_type IS NULL OR conv_type = 'support' THEN
        RETURN true;
    END IF;

    SELECT sender_id, created_at INTO last_sender, last_created
    FROM public.vb_chat_messages
    WHERE conversation_id = conv_id
    AND COALESCE(is_deleted, false) = false
    ORDER BY created_at DESC
    LIMIT 1;

    -- No messages yet: the dozent must write first.
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Reply: last message is from the dozent (or anyone else).
    IF last_sender IS DISTINCT FROM auth.uid() THEN
        RETURN true;
    END IF;

    -- Own last message: allowed only within a 7-day window.
    RETURN last_created > now() - interval '7 days';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.is_vb_conversation_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vb_teilnehmer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vb_can_send_message(uuid) TO authenticated;

-- ============================================================================
-- 3. Rewrite policies that recursed through vb_conversation_participants
-- ============================================================================
DROP POLICY IF EXISTS "VB: Users can view participants in their conversations" ON public.vb_conversation_participants;
CREATE POLICY "VB: Users can view participants in their conversations" ON public.vb_conversation_participants
    FOR SELECT USING (public.is_vb_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "VB: Users can view conversations they participate in" ON public.vb_conversations;
CREATE POLICY "VB: Users can view conversations they participate in" ON public.vb_conversations
    FOR SELECT USING (public.is_vb_conversation_participant(id));

DROP POLICY IF EXISTS "VB: Users can view messages in their conversations" ON public.vb_chat_messages;
CREATE POLICY "VB: Users can view messages in their conversations" ON public.vb_chat_messages
    FOR SELECT USING (public.is_vb_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "VB: Users can send messages in their conversations" ON public.vb_chat_messages;
CREATE POLICY "VB: Users can send messages in their conversations" ON public.vb_chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND public.is_vb_conversation_participant(conversation_id)
        AND public.vb_can_send_message(conversation_id)
    );
