/*
  # Add message email notification system

  1. Changes
    - Create function to trigger email notification for new messages
    - Create trigger to automatically send notifications when messages are inserted
    - Add RLS policies for message access

  2. Security
    - Email notifications are sent asynchronously
    - Failures in email sending don't affect message delivery
    - Uses Supabase Edge Functions for email sending
*/

-- Enable RLS on messages table if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for message access
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their received messages" ON messages;
CREATE POLICY "Users can update their received messages" ON messages
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid());

-- Create function to trigger email notification for new messages
CREATE OR REPLACE FUNCTION notify_message_recipient()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the edge function to send email notification
    -- This uses pg_net extension to make HTTP requests
    PERFORM
        net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/send-message-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
            ),
            body := jsonb_build_object(
                'messageId', NEW.id,
                'senderId', NEW.sender_id,
                'receiverId', NEW.receiver_id,
                'content', NEW.content
            )
        );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically send notifications on new messages
DROP TRIGGER IF EXISTS trigger_notify_message_recipient ON messages;
CREATE TRIGGER trigger_notify_message_recipient
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_message_recipient();

-- Create helper function to check if user is admin (used in policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update folder policies to use the helper function
DROP POLICY IF EXISTS "folders_access" ON folders;
CREATE POLICY "folders_access" ON folders
  FOR ALL TO authenticated
  USING ((user_id = auth.uid()) OR is_admin())
  WITH CHECK ((user_id = auth.uid()) OR is_admin());

-- Update file policies to use the helper function  
DROP POLICY IF EXISTS "files_access" ON files;
CREATE POLICY "files_access" ON files
  FOR ALL TO authenticated
  USING ((folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())) OR is_admin())
  WITH CHECK ((folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())) OR is_admin());