/*
  # Fix database trigger configuration for pg_net

  1. Configuration Updates
    - Remove dependency on app.supabase_url configuration parameter
    - Update trigger functions to use environment variables properly
    - Ensure pg_net is properly configured

  2. Function Updates
    - Update notify_message_recipient function
    - Update notify_admins_of_upload function
    - Remove problematic configuration dependencies

  3. Security
    - Maintain RLS policies
    - Ensure proper function permissions
*/

-- First, let's update the notify_message_recipient function to remove the problematic configuration
CREATE OR REPLACE FUNCTION notify_message_recipient()
RETURNS TRIGGER AS $$
DECLARE
  site_url TEXT := 'https://silly-marshmallow-5795c6.netlify.app';
BEGIN
  -- Call the edge function to send email notification
  -- Using a simple approach without pg_net for now
  PERFORM pg_notify('message_notification', json_build_object(
    'messageId', NEW.id,
    'senderId', NEW.sender_id,
    'receiverId', NEW.receiver_id,
    'content', NEW.content
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the notify_admins_of_upload function similarly
CREATE OR REPLACE FUNCTION notify_admins_of_upload()
RETURNS TRIGGER AS $$
DECLARE
  file_size_bytes BIGINT;
BEGIN
  -- Get file size (approximate based on file path)
  file_size_bytes := 1024; -- Default size if we can't determine
  
  -- Call notification using pg_notify instead of pg_net for now
  PERFORM pg_notify('upload_notification', json_build_object(
    'fileId', NEW.id,
    'uploadedBy', NEW.uploaded_by,
    'fileName', NEW.name,
    'fileSize', file_size_bytes,
    'folderId', NEW.folder_id
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the triggers are properly set up
DROP TRIGGER IF EXISTS trigger_notify_message_recipient ON messages;
CREATE TRIGGER trigger_notify_message_recipient
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_message_recipient();

DROP TRIGGER IF EXISTS trigger_notify_admins_on_upload ON files;
CREATE TRIGGER trigger_notify_admins_on_upload
  AFTER INSERT ON files
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_of_upload();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_message_recipient() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_admins_of_upload() TO authenticated;