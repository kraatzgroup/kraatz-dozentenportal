/*
  # Globale Unterschriften & Stempel (Defaults für Admin/Verwaltung/Buchhaltung)

  Veronika Kraatz' Unterschriften und Stempel sollen als Defaults für alle
  Admin-, Verwaltungs- und Buchhaltungs-Accounts verfügbar sein, damit diese
  nicht jedes Mal neu hochgeladen werden müssen.

  Lösung:
  - Neue Spalte is_global (BOOLEAN DEFAULT FALSE) in saved_signatures und
    saved_stamps.
  - Veronika Kraatz' bestehende Einträge werden auf is_global = TRUE gesetzt.
  - RLS: globale Einträge dürfen von allen admin/verwaltung/buchhaltung-Usern
    gelesen werden (SELECT). Schreiben (INSERT/UPDATE/DELETE) bleibt auf den
    eigenen User beschränkt, mit Ausnahme dass Admins globale Einträge
    umschalten/löschen dürfen.
  - Die Storage-Buckets signatures & stamps sind bereits über
    is_admin_or_verwaltung() für alle drei Rollen freigegeben.
*/

-- ============================================
-- Spalte is_global hinzufügen
-- ============================================
ALTER TABLE public.saved_signatures
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.saved_stamps
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.saved_signatures.is_global IS 'Wenn TRUE: Unterschrift ist eine globale Default-Unterschrift (sichtbar für alle Admin/Verwaltung/Buchhaltung-User)';
COMMENT ON COLUMN public.saved_stamps.is_global IS 'Wenn TRUE: Stempel ist ein globaler Default-Stempel (sichtbar für alle Admin/Verwaltung/Buchhaltung-User)';

-- ============================================
-- Veronika Kraatz' Einträge als global markieren
-- ============================================
UPDATE public.saved_signatures
SET is_global = TRUE
WHERE user_id = 'bea0bf54-416a-4ee0-8f0d-60d79800b31e';

UPDATE public.saved_stamps
SET is_global = TRUE
WHERE user_id = 'bea0bf54-416a-4ee0-8f0d-60d79800b31e';

-- ============================================
-- RLS: globale Einträge für alle admin/verwaltung/buchhaltung lesbar
-- ============================================

-- saved_signatures: SELECT (eigene ODER globale)
DROP POLICY IF EXISTS "adminverw manage own signatures" ON public.saved_signatures;
DROP POLICY IF EXISTS "adminverw select signatures" ON public.saved_signatures;

CREATE POLICY "adminverw select signatures" ON public.saved_signatures
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_verwaltung()
    AND (user_id = auth.uid() OR is_global = TRUE)
  );

-- INSERT/UPDATE/DELETE: nur eigene Einträge
CREATE POLICY "adminverw insert own signatures" ON public.saved_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_verwaltung() AND user_id = auth.uid()
  );

CREATE POLICY "adminverw update own signatures" ON public.saved_signatures
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_verwaltung()
    AND (user_id = auth.uid() OR is_global = TRUE)
  )
  WITH CHECK (
    public.is_admin_or_verwaltung() AND user_id = auth.uid()
  );

CREATE POLICY "adminverw delete own signatures" ON public.saved_signatures
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_verwaltung()
    AND (user_id = auth.uid() OR is_global = TRUE)
  );

-- saved_stamps: SELECT (eigene ODER globale)
DROP POLICY IF EXISTS "adminverw manage own stamps" ON public.saved_stamps;
DROP POLICY IF EXISTS "adminverw select stamps" ON public.saved_stamps;

CREATE POLICY "adminverw select stamps" ON public.saved_stamps
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_verwaltung()
    AND (user_id = auth.uid() OR is_global = TRUE)
  );

CREATE POLICY "adminverw insert own stamps" ON public.saved_stamps
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_verwaltung() AND user_id = auth.uid()
  );

CREATE POLICY "adminverw update own stamps" ON public.saved_stamps
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_verwaltung()
    AND (user_id = auth.uid() OR is_global = TRUE)
  )
  WITH CHECK (
    public.is_admin_or_verwaltung() AND user_id = auth.uid()
  );

CREATE POLICY "adminverw delete own stamps" ON public.saved_stamps
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_verwaltung()
    AND (user_id = auth.uid() OR is_global = TRUE)
  );

-- ============================================
-- Index für is_global (Performance bei vielen Einträgen)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_saved_signatures_is_global ON public.saved_signatures(is_global) WHERE is_global = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_stamps_is_global ON public.saved_stamps(is_global) WHERE is_global = TRUE;

DO $$
BEGIN
  RAISE NOTICE 'Globale Unterschriften/Stempel aktiviert – Veronika Kraatz Defaults für Admin/Verwaltung/Buchhaltung freigegeben';
END $$;
