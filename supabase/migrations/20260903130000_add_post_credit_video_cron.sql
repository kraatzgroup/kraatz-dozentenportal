-- Migration: Add hourly cron job to check for eligible post-credit-video users
-- and send them the upsell email from Mario Kraatz.
--
-- Runs every hour at minute 5 (offset from the existing pending-hours job
-- at minute 1 to avoid overlapping load).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the Edge Function via HTTP (pg_net)
CREATE OR REPLACE FUNCTION trigger_post_credit_video_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id int;
BEGIN
  SELECT
    net.http_post(
      url := 'https://gkkveloqajxghhflkfru.supabase.co/functions/v1/vb-post-credit-video-check',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) INTO request_id;

  RAISE NOTICE 'Triggered post-credit-video-check via Edge Function. Request ID: %', request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in trigger_post_credit_video_check: %', SQLERRM;
END;
$$;

-- Remove existing cron job if it exists
SELECT cron.unschedule('post-credit-video-check-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'post-credit-video-check-hourly'
);

-- Schedule: every hour at minute 5
SELECT cron.schedule(
  'post-credit-video-check-hourly',
  '5 * * * *',
  $$SELECT trigger_post_credit_video_check();$$
);

COMMENT ON FUNCTION trigger_post_credit_video_check IS
  'Triggers the vb-post-credit-video-check Edge Function hourly. Checks for VB users who received the test credit, opened their first correction, did not buy within 24h, and sends them the upsell email from Mario Kraatz.';

-- Log
DO $$
BEGIN
  RAISE NOTICE 'Cron job "post-credit-video-check-hourly" created successfully';
  RAISE NOTICE 'Schedule: Every hour at 5 minutes past the hour';
END $$;
