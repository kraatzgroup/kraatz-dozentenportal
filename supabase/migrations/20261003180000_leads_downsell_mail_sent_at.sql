-- Zeitpunkt, zu dem die Kraatz-Club-Infomail (Downsell) versendet wurde
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS downsell_mail_sent_at TIMESTAMPTZ;
