/*
  # Vertragsdokumente: Buckets privat machen

  Die Buckets signed-documents/signatures/stamps waren public=true, wodurch
  Objekte über die öffentliche URL abrufbar waren und die Storage-RLS umgangen
  werden konnte. Sie werden auf privat gestellt, sodass der Zugriff
  ausschließlich über die RLS-Policies (nur Admin/Verwaltung) erfolgt.

  Die App lädt Dateien via supabase.storage.download() (authentifiziert),
  daher ist keine Client-Änderung nötig.
*/

UPDATE storage.buckets
SET public = false
WHERE id IN ('signed-documents', 'signatures', 'stamps');
