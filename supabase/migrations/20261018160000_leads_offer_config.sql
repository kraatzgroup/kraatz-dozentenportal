-- Angebotskonfiguration (Stunden, Verteilung, Laufzeit, ELITE) am Lead, damit sie beim Abschluss wieder vorbelegt werden kann
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS offer_config JSONB;
