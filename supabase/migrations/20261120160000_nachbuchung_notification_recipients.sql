-- Benachrichtigungs-Empfänger für Nachbuchungen
-- Admin kann hier festlegen, wer zusaetzlich zu den Admins bei
-- Nachbuchungs-Ereignissen per Mail informiert wird.
-- Die Edge Functions lesen diese Tabelle zur Laufzeit aus,
-- Aenderungen wirken also sofort ohne Redeploy.

CREATE TABLE IF NOT EXISTS public.nachbuchung_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  -- Benachrichtigung, wenn das Formular an den Dozenten gesendet wurde
  notify_send boolean NOT NULL DEFAULT true,
  -- Benachrichtigung, wenn der Dozent geantwortet hat
  notify_response boolean NOT NULL DEFAULT true,
  -- Benachrichtigung, wenn eine Erinnerung an den Dozenten gesendet wurde
  notify_reminder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT nachbuchung_notification_recipients_email_key UNIQUE (email)
);

ALTER TABLE public.nachbuchung_notification_recipients ENABLE ROW LEVEL SECURITY;

-- Nur Admins verwalten die Liste (Service Role umgeht RLS komplett)
CREATE POLICY "adminverw_nachbuchung_notification_recipients"
  ON public.nachbuchung_notification_recipients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'admin'
          OR p.additional_roles @> ARRAY['admin']::text[]
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'admin'
          OR p.additional_roles @> ARRAY['admin']::text[]
        )
    )
  );

CREATE INDEX IF NOT EXISTS nachbuchung_notification_recipients_email_idx
  ON public.nachbuchung_notification_recipients (email);
