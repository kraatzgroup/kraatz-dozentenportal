-- Migration: Hängende Kraatz-Club-Zugänge sichtbar machen
--
-- Bleibt nach mehreren Versuchen die Rückmeldung von Zapier aus, wird der Zugang
-- jetzt als 'fehler' markiert (statt dauerhaft auf "... läuft" zu stehen) und
-- erscheint im Portal mit "erneut senden". Ausnahme: hängende Freischaltungen
-- nach Vertragsende werden weiterhin entzogen statt als Fehler markiert.

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

  -- Nach max. Versuchen ohne Rückmeldung -> als Fehler markieren
  UPDATE public.memberspot_kraatzclub_zugaenge z
     SET status = 'fehler',
         last_error = 'Keine Rückmeldung von Zapier nach ' || z.versuche || ' Versuchen – bitte Zap History prüfen'
    FROM public.memberspot_kraatzclub_mitglieder m
   WHERE m.id = z.mitglied_id
     AND z.versuche >= p_max_versuche
     AND z.gesendet_at < NOW() - INTERVAL '6 hours'
     AND (
       z.status = 'entzug_gesendet'
       OR (z.status = 'freischaltung_gesendet' AND (z.dauerhaft OR m.vertragsende >= v_heute))
     );

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
