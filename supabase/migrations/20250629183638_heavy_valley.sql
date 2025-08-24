/*
  # Fix message notification trigger to call edge function

  1. Updates
    - Update notify_message_recipient function to use pg_net to call edge function
    - Update notify_admins_of_upload function to use pg_net to call edge function
    - Ensure proper error handling and logging

  2. Security
    - Functions run with SECURITY DEFINER to access pg_net
    - Proper permissions granted
*/

-- Update the notify_message_recipient function to call the edge function via HTTP
CREATE OR REPLACE FUNCTION notify_message_recipient()
RETURNS TRIGGER AS $$
DECLARE
  site_url TEXT;
  function_url TEXT;
  payload JSON;
  response_id BIGINT;
BEGIN
  -- Get the site URL from environment or use default
  site_url := COALESCE(current_setting('app.supabase_url', true), 'https://baxmpvbwvtlbrzchabfw.supabase.co');
  function_url := site_url || '/functions/v1/send-message-notification';
  
  -- Prepare the payload
  payload := json_build_object(
    'messageId', NEW.id,
    'senderId', NEW.sender_id,
    'receiverId', NEW.receiver_id,
    'content', NEW.content
  );
  
  -- Make HTTP request to edge function using pg_net
  SELECT INTO response_id net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
    ),
    body := payload::jsonb
  );
  
  -- Log the request (optional, for debugging)
  RAISE LOG 'Message notification sent for message ID: %, response ID: %', NEW.id, response_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE LOG 'Failed to send message notification for message ID: %, error: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the notify_admins_of_upload function to call the edge function via HTTP
CREATE OR REPLACE FUNCTION notify_admins_of_upload()
RETURNS TRIGGER AS $$
DECLARE
  site_url TEXT;
  function_url TEXT;
  payload JSON;
  response_id BIGINT;
  file_size_bytes BIGINT;
BEGIN
  -- Get the site URL from environment or use default
  site_url := COALESCE(current_setting('app.supabase_url', true), 'https://baxmpvbwvtlbrzchabfw.supabase.co');
  function_url := site_url || '/functions/v1/send-upload-notification';
  
  -- Estimate file size (we don't have actual size in trigger context)
  file_size_bytes := 1024 * 100; -- Default to 100KB
  
  -- Prepare the payload
  payload := json_build_object(
    'fileId', NEW.id,
    'uploadedBy', NEW.uploaded_by,
    'fileName', NEW.name,
    'fileSize', file_size_bytes,
    'folderId', NEW.folder_id
  );
  
  -- Make HTTP request to edge function using pg_net
  SELECT INTO response_id net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
    ),
    body := payload::jsonb
  );
  
  -- Log the request (optional, for debugging)
  RAISE LOG 'Upload notification sent for file ID: %, response ID: %', NEW.id, response_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the file insert
    RAISE LOG 'Failed to send upload notification for file ID: %, error: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set the required configuration parameters for the functions
-- These need to be set at the database level
DO $$
BEGIN
  -- Set the Supabase URL
  PERFORM set_config('app.supabase_url', 'https://baxmpvbwvtlbrzchabfw.supabase.co', false);
  
  -- Set the anon key
  PERFORM set_config('app.supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheG1wdmJ3dnRsYnJ6Y2hhYmZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDQwMzgsImV4cCI6MjA2Njc4MDAzOH0.RECgjDVX5xmkmbKTa4xYxgLsrcpWiODAdO999emYhmk', false);
END $$;

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
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;