-- Migration: Stündlicher Cron-Job für die Kraatz-Club-Provisionierung (Memberspot via Zapier)
--
-- Ruft jede Stunde zur Minute 15 die Edge Function memberspot-kraatzclub-sync
-- auf (versetzt zu den bestehenden Jobs um Minute 1 und 5). Die Funktion
-- schaltet fällige Zugänge ab Vertragsbeginn frei und entzieht sie nach
-- Vertragsende (außer Free Access).

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION trigger_memberspot_kraatzclub_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id int;
BEGIN
  SELECT
    net.http_post(
      url := 'https://gkkveloqajxghhflkfru.supabase.co/functions/v1/memberspot-kraatzclub-sync',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) INTO request_id;

  RAISE NOTICE 'Triggered memberspot-kraatzclub-sync via Edge Function. Request ID: %', request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in trigger_memberspot_kraatzclub_sync: %', SQLERRM;
END;
$$;

SELECT cron.unschedule('memberspot-kraatzclub-sync-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'memberspot-kraatzclub-sync-hourly'
);

SELECT cron.schedule(
  'memberspot-kraatzclub-sync-hourly',
  '15 * * * *',
  $$SELECT trigger_memberspot_kraatzclub_sync();$$
);

COMMENT ON FUNCTION trigger_memberspot_kraatzclub_sync IS
  'Triggers the memberspot-kraatzclub-sync Edge Function hourly (minute 15). Grants due Kraatz-Club accesses in Memberspot via Zapier and revokes them after Vertragsende (except Free Access).';
