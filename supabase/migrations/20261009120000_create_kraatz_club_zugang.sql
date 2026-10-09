/*
  # Feature "Kraatz Club Zugang"

  Neue Tabelle:
  - kraatz_club_zugang: verwaltete Gratis-Zugänge zum Kraatz Club.

  Zugriff (RLS): nur User mit Rolle admin, verwaltung ODER buchhaltung
  (gleiche Helper-Funktion is_admin_or_verwaltung() wie beim Verträge-Tool).
*/

CREATE TABLE IF NOT EXISTS public.kraatz_club_zugang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT NOT NULL,
  vertragsbeginn DATE NOT NULL,
  vertragsende DATE NOT NULL,
  zugang TEXT[] NOT NULL DEFAULT '{}'
    CHECK (zugang <@ ARRAY['Premium-Mitgliedschaft', 'Ein Monat gratis', 'Zivilrecht', 'Strafrecht', 'Öffentliches Recht']::text[]),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kraatz_club_zugang_created_at
  ON public.kraatz_club_zugang(created_at DESC);

ALTER TABLE public.kraatz_club_zugang ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adminverw manage kraatz_club_zugang" ON public.kraatz_club_zugang;
CREATE POLICY "adminverw manage kraatz_club_zugang" ON public.kraatz_club_zugang
  FOR ALL TO authenticated
  USING (public.is_admin_or_verwaltung())
  WITH CHECK (public.is_admin_or_verwaltung());
