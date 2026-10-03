-- Angebotsdetails am Lead: gewähltes Paket und geplanter Start (Anzeige auf der Pipeline-Karte)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS offer_package TEXT,
  ADD COLUMN IF NOT EXISTS offer_start_date DATE;
