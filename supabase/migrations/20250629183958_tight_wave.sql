/*
  # Remove problematic database triggers

  This migration removes the database triggers that were causing issues with pg_net
  and configuration parameters. The edge functions will now be called directly
  from the frontend instead of through database triggers.

  1. Changes
    - Remove trigger_notify_message_recipient trigger
    - Remove trigger_notify_admins_on_upload trigger
    - Keep the functions for potential future use but disable triggers
    
  2. Rationale
    - Database triggers with HTTP calls are complex and error-prone
    - Direct frontend calls are more reliable and easier to debug
    - Email notifications are not critical for core functionality
*/

-- Remove the problematic triggers
DROP TRIGGER IF EXISTS trigger_notify_message_recipient ON messages;
DROP TRIGGER IF EXISTS trigger_notify_admins_on_upload ON files;

-- Keep the functions but comment them out for future reference
-- We're not dropping them in case we want to re-enable later

-- Add a comment to the functions to indicate they're disabled
COMMENT ON FUNCTION notify_message_recipient() IS 'DISABLED: Function exists but trigger removed. Email notifications now handled by frontend.';
COMMENT ON FUNCTION notify_admins_of_upload() IS 'DISABLED: Function exists but trigger removed. Email notifications now handled by frontend.';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Database triggers for email notifications have been removed. Email notifications are now handled directly by the frontend.';
END $$;