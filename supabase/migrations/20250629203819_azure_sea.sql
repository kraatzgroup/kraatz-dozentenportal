/*
  # Update Site URL in environment variables

  1. Changes
    - Update SITE_URL environment variable to use the new domain
    - This affects all email links sent by the system
    - Ensures consistent branding and proper redirects

  2. Security
    - No security implications, just URL updates
*/

-- This migration doesn't make database changes
-- It's a reminder to update the SITE_URL environment variable in the Supabase dashboard

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'IMPORTANT: Update the SITE_URL environment variable in the Supabase dashboard to: http://portal.kraatz-group.de';
  RAISE NOTICE 'This affects all email links (password reset, invitations, etc.)';
END $$;