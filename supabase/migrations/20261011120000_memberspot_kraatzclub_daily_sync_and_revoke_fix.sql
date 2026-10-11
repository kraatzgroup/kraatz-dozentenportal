-- Migration: Kraatz-Club-Sync täglich um 00:15 (Europe/Berlin) + robusterer Entzug
--
-- 1. pg_cron läuft in GMT. Damit der Job sommers wie winters um 00:15 deutscher
--    Zeit läuft, wird er um 22:15 und 23:15 UTC eingeplant; die Trigger-Funktion
--    führt den Sync nur aus, wenn es in Berlin gerade 0 Uhr ist.
--    Neue Mitglieder werden weiterhin sofort nach dem Speichern freigeschaltet
--    (Aufruf aus dem Formular).
--
-- 2. Entzug nach Vertragsende auch dann, wenn die Rückmeldung von Zapier zur
--    Freischaltung fehlt (Status 'freischaltung_gesendet') oder die Freischaltung
--    als 'fehler' markiert ist. Ein Entzug eines nie freigeschalteten Zugangs ist
--    in Memberspot unschädlich. Dauerhafte Offers (Free Access) bleiben ausgenommen.

CREATE OR REPLACE FUNCTION public.memberspot_kc_claim_due(p_max_versuche INT DEFAULT 5)
RETURNS TABLE (
  zugang_id UUID,
  aktion TEXT,
  mitglied_id UUID,
  vorname TEXT,
  nachname TEXT,
  email TEXT,
  vertragsbeginn DATE,
  vertragsende DATE,
  zugang TEXT,
  offer_id TEXT,
  order_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_heute DATE := (NOW() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
  -- Noch nie an Memberspot gesendet, aber Vertrag schon vorbei -> nicht mehr freischalten
  UPDATE public.memberspot_kraatzclub_zugaenge z
     SET status = 'uebersprungen'
    FROM public.memberspot_kraatzclub_mitglieder m
   WHERE m.id = z.mitglied_id
     AND z.status = 'ausstehend'
     AND NOT z.dauerhaft
     AND m.vertragsende < v_heute;

  RETURN QUERY
  WITH due AS (
    SELECT
      z.id,
      CASE WHEN NOT z.dauerhaft AND m.vertragsende < v_heute THEN 'revoke' ELSE 'grant' END AS aktion,
      m.id AS mitglied_id, m.vorname, m.nachname, m.email, m.vertragsbeginn, m.vertragsende,
      z.zugang, z.offer_id, z.order_id
    FROM public.memberspot_kraatzclub_zugaenge z
    JOIN public.memberspot_kraatzclub_mitglieder m ON m.id = z.mitglied_id
    WHERE (
        -- Freischalten: ab Vertragsbeginn (Free Access auch nach Vertragsende)
        (
          z.versuche < p_max_versuche
          AND m.vertragsbeginn <= v_heute
          AND (z.dauerhaft OR m.vertragsende >= v_heute)
          AND (
            z.status = 'ausstehend'
            OR (z.status = 'fehler' AND z.letzte_aktion = 'grant')
            OR (z.status = 'freischaltung_gesendet' AND z.gesendet_at < NOW() - INTERVAL '6 hours')
          )
        )
        OR
        -- Entziehen: nach Vertragsende, nie für dauerhafte Offers.
        -- Auch ohne bestätigte Freischaltung, damit kein Zugang hängen bleibt.
        (
          NOT z.dauerhaft
          AND m.vertragsende < v_heute
          AND (
            z.status IN ('aktiv', 'freischaltung_gesendet')
            OR (z.status = 'fehler' AND (z.letzte_aktion = 'grant' OR z.versuche < p_max_versuche))
            OR (z.status = 'entzug_gesendet' AND z.gesendet_at < NOW() - INTERVAL '6 hours' AND z.versuche < p_max_versuche)
          )
        )
      )
    FOR UPDATE OF z SKIP LOCKED
  )
  UPDATE public.memberspot_kraatzclub_zugaenge z
     SET status = CASE WHEN due.aktion = 'grant' THEN 'freischaltung_gesendet' ELSE 'entzug_gesendet' END,
         -- Beim Wechsel von Freischaltung zu Entzug neu zählen
         versuche = CASE WHEN z.letzte_aktion IS DISTINCT FROM due.aktion THEN 1 ELSE z.versuche + 1 END,
         letzte_aktion = due.aktion,
         gesendet_at = NOW(),
         last_error = NULL
    FROM due
   WHERE z.id = due.id
  RETURNING z.id, due.aktion, due.mitglied_id, due.vorname, due.nachname, due.email,
            due.vertragsbeginn, due.vertragsende, due.zugang, due.offer_id, due.order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.memberspot_kc_claim_due(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.memberspot_kc_claim_due(INT) TO service_role;

-- Trigger-Funktion: nur um 0 Uhr Berliner Zeit ausführen
CREATE OR REPLACE FUNCTION trigger_memberspot_kraatzclub_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id int;
BEGIN
  IF EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Europe/Berlin')) <> 0 THEN
    RETURN;
  END IF;

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

COMMENT ON FUNCTION trigger_memberspot_kraatzclub_sync IS
  'Triggers the memberspot-kraatzclub-sync Edge Function daily at 00:15 Europe/Berlin (scheduled 22:15 and 23:15 UTC, runs only when it is 0 o''clock in Berlin).';

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('memberspot-kraatzclub-sync-hourly', 'memberspot-kraatzclub-sync-daily');

SELECT cron.schedule(
  'memberspot-kraatzclub-sync-daily',
  '15 22,23 * * *',
  $$SELECT trigger_memberspot_kraatzclub_sync();$$
);
