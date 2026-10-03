-- Zeitpunkt des Angebotsversands: Grundlage für den Follow-up-Anruf (2. Gespräch)
-- spätestens 24 Stunden nach Versand, solange der Lead nicht weitergezogen wurde.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS offer_sent_at TIMESTAMPTZ;
