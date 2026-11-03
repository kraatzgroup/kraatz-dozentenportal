-- Migration: Härte den stündlichen pending-hours-Job ab
-- Created: 2026-11-03
-- Description: Die direkte DB-Generierung (generate_pending_hours_from_elite_units)
--   soll IMMER laufen, auch wenn der zusätzliche HTTP-Aufruf der Edge Function
--   fehlschlägt. Vorher konnte ein Fehler in net.http_post die gesamte
--   Transaktion in den EXCEPTION-Zweig werfen und damit die direkte Generierung
--   überspringen.

CREATE OR REPLACE FUNCTION public.trigger_pending_hours_generation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id int;
BEGIN
  -- Direkt die DB-Funktion aufrufen (zuverlässiger Kern des Jobs).
  PERFORM public.generate_pending_hours_from_elite_units();

  -- Zusätzlich die Edge Function triggern (optional; darf den Job nicht
  -- verhindern). Fehler hier werden isoliert und nur als WARNING geloggt.
  BEGIN
    SELECT net.http_post(
      url := 'https://gkkveloqajxghhflkfru.supabase.co/functions/v1/generate-pending-hours',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) INTO request_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Edge Function Trigger fehlgeschlagen: %', SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION public.trigger_pending_hours_generation() IS 'Runs pending-hours generation directly in the DB first, then optionally triggers the Edge Function. The Edge Function failure cannot prevent generation.';