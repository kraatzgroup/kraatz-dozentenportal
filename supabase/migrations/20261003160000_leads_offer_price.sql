-- Angebotspreis am Lead (Anzeige auf der Pipeline-Karte, "💰 140 Stunden Paket · 19.530,00 €")
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS offer_price NUMERIC;
