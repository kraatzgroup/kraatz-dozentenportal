/*
  # Buchhaltung Vollzugriff auf Verträge-Unterschreiben-Tool

  Die RLS-Policies für signed_documents, saved_signatures, saved_stamps sowie
  die Storage-Buckets (signed-documents, signatures, stamps) und die
  contracts-SELECT-Policy verwenden alle die Helper-Funktion
  is_admin_or_verwaltung(). Diese prüfte bisher nur die Rollen 'admin' und
  'verwaltung', nicht aber 'buchhaltung'.

  Dadurch bekamen Buchhaltungs-User beim Hochladen/Bearbeiten/Löschen von
  Verträgen den Fehler "new row violates row-level security policy".

  Fix: is_admin_or_verwaltung() wird um 'buchhaltung' erweitert, sodass
  Admin, Verwaltung UND Buchhaltung vollen Zugriff (hochladen, bearbeiten,
  löschen, unterschreiben) auf das Verträge-Tool haben.
*/

CREATE OR REPLACE FUNCTION public.is_admin_or_verwaltung()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'verwaltung', 'buchhaltung')
        OR p.additional_roles && ARRAY['admin', 'verwaltung', 'buchhaltung']::text[]
      )
  );
$$;

DO $$
BEGIN
  RAISE NOTICE 'is_admin_or_verwaltung() um buchhaltung erweitert – Verträge-Tool jetzt für Admin/Verwaltung/Buchhaltung freigegeben';
END $$;
