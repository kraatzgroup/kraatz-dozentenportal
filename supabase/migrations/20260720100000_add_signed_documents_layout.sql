/*
  # Positionen (Layout) für signierte Dokumente speichern

  Fügt eine JSONB-Spalte `layout` zu signed_documents hinzu, in der die
  platzierten Elemente (Position, Größe, Text, Referenz auf gespeicherte
  Unterschrift/Stempel) als Entwurf gespeichert werden.
*/

ALTER TABLE public.signed_documents
  ADD COLUMN IF NOT EXISTS layout JSONB;

COMMENT ON COLUMN public.signed_documents.layout IS 'Platzierte Elemente (Annotations) als Entwurf: Position, Größe, Text, storagePath';
