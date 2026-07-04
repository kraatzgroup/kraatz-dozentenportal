-- Fix: Security Definer View linter error for vb_conversation_details
-- Postgres views default to SECURITY DEFINER semantics (run with the
-- view creator's privileges). Supabase's linter flags this because it
-- bypasses the querying user's RLS. Switching to security_invoker
-- makes the view respect the caller's permissions and RLS policies.
--
-- Also fix vb_get_unread_message_count function which is called by the view.
-- The function already uses auth.uid() for filtering, so it doesn't need
-- SECURITY DEFINER.

-- Recreate the function without SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.vb_get_unread_message_count(conversation_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.vb_chat_messages m
        WHERE m.conversation_id = conversation_uuid
        AND m.created_at > (
            SELECT COALESCE(last_read_at, '1970-01-01'::timestamp)
            FROM public.vb_conversation_participants
            WHERE conversation_id = conversation_uuid
            AND profile_id = auth.uid()
        )
        AND m.sender_id != auth.uid()
    );
END;
$function$;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION public.vb_get_unread_message_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vb_get_unread_message_count(uuid) TO anon;

-- Set security_invoker on the view to respect caller's RLS
ALTER VIEW public.vb_conversation_details SET (security_invoker = true);
