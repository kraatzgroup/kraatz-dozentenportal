-- Create teilnehmer_notes table for chronological notes on participants
CREATE TABLE IF NOT EXISTS teilnehmer_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teilnehmer_id uuid NOT NULL REFERENCES teilnehmer(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  author_short text NOT NULL, -- e.g. "CN" for Charlene Nowak
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookup by teilnehmer
CREATE INDEX idx_teilnehmer_notes_teilnehmer_id ON teilnehmer_notes(teilnehmer_id);

-- RLS
ALTER TABLE teilnehmer_notes ENABLE ROW LEVEL SECURITY;

-- Allow admin, verwaltung, buchhaltung, vertrieb to read/write notes
CREATE POLICY "Staff can view teilnehmer notes"
  ON teilnehmer_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'verwaltung', 'buchhaltung', 'vertrieb')
        OR 'admin' = ANY(p.additional_roles)
        OR 'verwaltung' = ANY(p.additional_roles)
        OR 'buchhaltung' = ANY(p.additional_roles)
        OR 'vertrieb' = ANY(p.additional_roles)
      )
    )
  );

CREATE POLICY "Staff can insert teilnehmer notes"
  ON teilnehmer_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'verwaltung', 'buchhaltung', 'vertrieb')
        OR 'admin' = ANY(p.additional_roles)
        OR 'verwaltung' = ANY(p.additional_roles)
        OR 'buchhaltung' = ANY(p.additional_roles)
        OR 'vertrieb' = ANY(p.additional_roles)
      )
    )
  );

CREATE POLICY "Staff can delete own teilnehmer notes"
  ON teilnehmer_notes FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR 'admin' = ANY(p.additional_roles))
    )
  );
