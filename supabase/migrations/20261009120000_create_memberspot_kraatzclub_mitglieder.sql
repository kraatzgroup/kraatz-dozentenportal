/*
  # Feature "Kraatz Club Zugang" (Memberspot via Zapier)

  Tabellen:
  - memberspot_kraatzclub_mitglieder:  Stammdaten + Vertrag (aus dem Formular)
  - memberspot_offer_mapping:          Formular-Zugang -> Memberspot-Offer-ID
  - memberspot_kraatzclub_zugaenge:    ein Eintrag pro Mitglied und Offer mit
                                       Provisionierungs-Status

  Bewusst KEINE Verknüpfung zu public.teilnehmer – die Kraatz-Club-Mitglieder
  werden vollständig getrennt von unseren Teilnehmern verwaltet.

  Ablauf:
  - Beim Anlegen eines Mitglieds werden automatisch Zugänge für alle
    ausgewählten Offers + "Free Access" (dauerhaft) erzeugt.
  - memberspot_kc_claim_due() liefert fällige Freischaltungen
    (ab Vertragsbeginn) und Entzüge (nach Vertragsende, außer Free Access)
    und markiert sie atomar als "gesendet". Die Edge Function
    memberspot-kraatzclub-sync schickt sie an Zapier, Zapier meldet das
    Ergebnis an memberspot-kraatzclub-callback zurück.

  Zugriff (RLS): nur User mit Rolle admin, verwaltung ODER buchhaltung.
*/

-- ============================================
-- Mitglieder
-- ============================================
CREATE TABLE IF NOT EXISTS public.memberspot_kraatzclub_mitglieder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT NOT NULL,
  vertragsbeginn DATE NOT NULL,
  vertragsende DATE NOT NULL,
  zugang TEXT[] NOT NULL DEFAULT '{}'
    CHECK (
      cardinality(zugang) > 0
      AND zugang <@ ARRAY['Premium-Mitgliedschaft', 'Zivilrecht', 'Strafrecht', 'Öffentliches Recht']::text[]
    ),
  memberspot_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (vertragsende >= vertragsbeginn)
);

CREATE INDEX IF NOT EXISTS idx_memberspot_kraatzclub_mitglieder_created_at
  ON public.memberspot_kraatzclub_mitglieder (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memberspot_kraatzclub_mitglieder_email
  ON public.memberspot_kraatzclub_mitglieder (lower(email));

-- ============================================
-- Offer-Mapping (Formular-Zugang -> Memberspot-Offer)
-- ============================================
CREATE TABLE IF NOT EXISTS public.memberspot_offer_mapping (
  zugang TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  offer_label TEXT,
  dauerhaft BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON COLUMN public.memberspot_offer_mapping.dauerhaft IS
  'TRUE = wird jedem Mitglied zusätzlich vergeben und bei Vertragsende NICHT entzogen (Free Access).';

INSERT INTO public.memberspot_offer_mapping (zugang, offer_id, offer_label, dauerhaft) VALUES
  ('Premium-Mitgliedschaft', '8pCxml7ZdMvteBrVLPNY',     'Zugang: KOMPLETTPAKET',     FALSE),
  ('Zivilrecht',             '6807508cc815aea0a1acdc79', 'Examen Zivilrecht',         FALSE),
  ('Strafrecht',             '6807509f75f8fc5b2a026e39', 'Examen Strafrecht',         FALSE),
  ('Öffentliches Recht',     '680750abc815aea0a1ace65e', 'Examen öffentliches Recht', FALSE),
  ('Free Access',            '682b56e1417f4d5f176863c8', 'Free Access',               TRUE)
ON CONFLICT (zugang) DO UPDATE
  SET offer_id = EXCLUDED.offer_id,
      offer_label = EXCLUDED.offer_label,
      dauerhaft = EXCLUDED.dauerhaft;

-- ============================================
-- Zugänge (ein Eintrag pro Mitglied und Offer)
-- ============================================
CREATE TABLE IF NOT EXISTS public.memberspot_kraatzclub_zugaenge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitglied_id UUID NOT NULL REFERENCES public.memberspot_kraatzclub_mitglieder(id) ON DELETE CASCADE,
  zugang TEXT NOT NULL REFERENCES public.memberspot_offer_mapping(zugang),
  offer_id TEXT NOT NULL,
  dauerhaft BOOLEAN NOT NULL DEFAULT FALSE,
  order_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ausstehend'
    CHECK (status IN (
      'ausstehend',              -- wartet auf Vertragsbeginn
      'freischaltung_gesendet',  -- an Zapier übergeben, Rückmeldung offen
      'aktiv',                   -- in Memberspot freigeschaltet
      'entzug_gesendet',         -- Entzug an Zapier übergeben, Rückmeldung offen
      'entzogen',                -- in Memberspot entzogen
      'uebersprungen',           -- Vertrag war schon vorbei, bevor freigeschaltet wurde
      'fehler'
    )),
  letzte_aktion TEXT CHECK (letzte_aktion IN ('grant', 'revoke')),
  versuche INT NOT NULL DEFAULT 0,
  gesendet_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mitglied_id, zugang)
);

CREATE INDEX IF NOT EXISTS idx_memberspot_kraatzclub_zugaenge_mitglied
  ON public.memberspot_kraatzclub_zugaenge (mitglied_id);

CREATE INDEX IF NOT EXISTS idx_memberspot_kraatzclub_zugaenge_offen
  ON public.memberspot_kraatzclub_zugaenge (status)
  WHERE status NOT IN ('entzogen', 'uebersprungen');

-- ============================================
-- updated_at Trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.set_memberspot_kc_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberspot_kraatzclub_mitglieder_updated_at ON public.memberspot_kraatzclub_mitglieder;
CREATE TRIGGER trg_memberspot_kraatzclub_mitglieder_updated_at
  BEFORE UPDATE ON public.memberspot_kraatzclub_mitglieder
  FOR EACH ROW EXECUTE FUNCTION public.set_memberspot_kc_updated_at();

DROP TRIGGER IF EXISTS trg_memberspot_kraatzclub_zugaenge_updated_at ON public.memberspot_kraatzclub_zugaenge;
CREATE TRIGGER trg_memberspot_kraatzclub_zugaenge_updated_at
  BEFORE UPDATE ON public.memberspot_kraatzclub_zugaenge
  FOR EACH ROW EXECUTE FUNCTION public.set_memberspot_kc_updated_at();

-- ============================================
-- Zugänge beim Anlegen eines Mitglieds erzeugen
-- (ausgewählte Offers + alle dauerhaften Offers wie "Free Access")
-- ============================================
CREATE OR REPLACE FUNCTION public.memberspot_kc_create_zugaenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.memberspot_kraatzclub_zugaenge (mitglied_id, zugang, offer_id, dauerhaft, order_id)
  SELECT NEW.id, m.zugang, m.offer_id, m.dauerhaft, 'kc-' || NEW.id || '-' || m.offer_id
  FROM public.memberspot_offer_mapping m
  WHERE m.zugang = ANY (NEW.zugang) OR m.dauerhaft
  ON CONFLICT (mitglied_id, zugang) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberspot_kc_create_zugaenge ON public.memberspot_kraatzclub_mitglieder;
CREATE TRIGGER trg_memberspot_kc_create_zugaenge
  AFTER INSERT ON public.memberspot_kraatzclub_mitglieder
  FOR EACH ROW EXECUTE FUNCTION public.memberspot_kc_create_zugaenge();

-- ============================================
-- Fällige Freischaltungen / Entzüge atomar "claimen"
-- Wird nur von der Edge Function (service_role) aufgerufen.
-- ============================================
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
  -- Noch nie freigeschaltet, aber Vertrag schon vorbei -> nicht mehr freischalten
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
    WHERE z.versuche < p_max_versuche
      AND (
        -- Freischalten: ab Vertragsbeginn (Free Access auch nach Vertragsende)
        (
          m.vertragsbeginn <= v_heute
          AND (z.dauerhaft OR m.vertragsende >= v_heute)
          AND (
            z.status = 'ausstehend'
            OR (z.status = 'fehler' AND z.letzte_aktion = 'grant')
            OR (z.status = 'freischaltung_gesendet' AND z.gesendet_at < NOW() - INTERVAL '6 hours')
          )
        )
        OR
        -- Entziehen: nach Vertragsende, nie für dauerhafte Offers
        (
          NOT z.dauerhaft
          AND m.vertragsende < v_heute
          AND (
            z.status = 'aktiv'
            OR (z.status = 'fehler' AND z.letzte_aktion = 'revoke')
            OR (z.status = 'entzug_gesendet' AND z.gesendet_at < NOW() - INTERVAL '6 hours')
          )
        )
      )
    FOR UPDATE OF z SKIP LOCKED
  )
  UPDATE public.memberspot_kraatzclub_zugaenge z
     SET status = CASE WHEN due.aktion = 'grant' THEN 'freischaltung_gesendet' ELSE 'entzug_gesendet' END,
         letzte_aktion = due.aktion,
         versuche = z.versuche + 1,
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

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.memberspot_kraatzclub_mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberspot_offer_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberspot_kraatzclub_zugaenge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adminverw manage memberspot_kraatzclub_mitglieder" ON public.memberspot_kraatzclub_mitglieder;
CREATE POLICY "adminverw manage memberspot_kraatzclub_mitglieder" ON public.memberspot_kraatzclub_mitglieder
  FOR ALL TO authenticated
  USING (public.is_admin_or_verwaltung())
  WITH CHECK (public.is_admin_or_verwaltung());

DROP POLICY IF EXISTS "adminverw manage memberspot_offer_mapping" ON public.memberspot_offer_mapping;
CREATE POLICY "adminverw manage memberspot_offer_mapping" ON public.memberspot_offer_mapping
  FOR ALL TO authenticated
  USING (public.is_admin_or_verwaltung())
  WITH CHECK (public.is_admin_or_verwaltung());

DROP POLICY IF EXISTS "adminverw manage memberspot_kraatzclub_zugaenge" ON public.memberspot_kraatzclub_zugaenge;
CREATE POLICY "adminverw manage memberspot_kraatzclub_zugaenge" ON public.memberspot_kraatzclub_zugaenge
  FOR ALL TO authenticated
  USING (public.is_admin_or_verwaltung())
  WITH CHECK (public.is_admin_or_verwaltung());
