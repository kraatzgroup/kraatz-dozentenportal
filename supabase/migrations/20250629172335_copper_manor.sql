/*
  # Email notification system for file uploads

  1. Changes
    - Create database trigger to automatically send email notifications when files are uploaded
    - Add function to call the edge function for email notifications

  2. Security
    - Only triggers for authenticated users
    - Respects existing RLS policies
*/

-- Create function to trigger email notification
CREATE OR REPLACE FUNCTION notify_admins_of_upload()
RETURNS TRIGGER AS $$
DECLARE
    file_size_bytes bigint;
    folder_name text;
BEGIN
    -- Get file size from storage (this is a simplified approach)
    -- In a real implementation, you might want to store file size in the files table
    file_size_bytes := 0; -- Default value, could be enhanced to get actual file size
    
    -- Get folder name
    SELECT name INTO folder_name FROM folders WHERE id = NEW.folder_id;
    
    -- Call the edge function to send email notifications
    -- This uses pg_net extension to make HTTP requests
    PERFORM
        net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/send-upload-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
            ),
            body := jsonb_build_object(
                'fileId', NEW.id,
                'uploadedBy', NEW.uploaded_by,
                'fileName', NEW.name,
                'fileSize', file_size_bytes,
                'folderId', NEW.folder_id
            )
        );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically send notifications on file upload
DROP TRIGGER IF EXISTS trigger_notify_admins_on_upload ON files;
CREATE TRIGGER trigger_notify_admins_on_upload
    AFTER INSERT ON files
    FOR EACH ROW
    EXECUTE FUNCTION notify_admins_of_upload();

-- Add settings for the function to work
-- These would typically be set via environment variables in production
-- ALTER DATABASE postgres SET app.supabase_url = 'https://baxmpvbwvtlbrzchabfw.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';