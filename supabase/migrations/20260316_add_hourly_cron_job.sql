-- Migration: Add hourly cron job to generate pending hours for Elite-Kleingruppe
-- Created: 2026-03-16
-- Description: Automatically checks every hour (1 minute past the hour) for completed units

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the Edge Function via HTTP
CREATE OR REPLACE FUNCTION trigger_pending_hours_generation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id int;
  response_status int;
  response_content text;
BEGIN
  -- Call the Edge Function using pg_net (Supabase's HTTP extension)
  SELECT 
    net.http_post(
      url := 'https://gkkveloqajxghhflkfru.supabase.co/functions/v1/generate-pending-hours',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) INTO request_id;

  -- Log the request
  RAISE NOTICE 'Triggered pending hours generation via Edge Function. Request ID: %', request_id;
  
  -- Alternatively, call the database function directly (more reliable)
  PERFORM generate_pending_hours_from_elite_units();
  
  RAISE NOTICE 'Pending hours generation completed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in trigger_pending_hours_generation: %', SQLERRM;
END;
$$;

-- Remove existing cron job if it exists (to avoid duplicates)
SELECT cron.unschedule('generate-pending-hours-hourly') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate-pending-hours-hourly'
);

-- Schedule the cron job to run every hour at 1 minute past the hour
-- Cron format: minute hour day month weekday
-- '1 * * * *' means: at minute 1 of every hour
-- Note: pg_cron runs in the database timezone (Europe/Berlin as set in previous migration)
SELECT cron.schedule(
  'generate-pending-hours-hourly',  -- Job name
  '1 * * * *',                       -- Cron schedule: 1 minute past every hour
  $$SELECT trigger_pending_hours_generation();$$
);

-- Add comments for documentation
COMMENT ON FUNCTION trigger_pending_hours_generation() IS 'Triggers the generation of pending hours for completed Elite-Kleingruppe units. Called by cron job every hour at minute 1.';

-- Log the cron job creation
DO $$
BEGIN
  RAISE NOTICE 'Cron job "generate-pending-hours-hourly" created successfully';
  RAISE NOTICE 'Schedule: Every hour at 1 minute past the hour (Europe/Berlin timezone)';
  RAISE NOTICE 'This will check for completed Elite-Kleingruppe units (both Unterricht and Wiederholung)';
  RAISE NOTICE 'and create pending entries in dozent activity reports for confirmation';
END $$;

-- View the scheduled job
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'generate-pending-hours-hourly';
