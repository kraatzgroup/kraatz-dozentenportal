-- Grund der Unqualifizierung (Downsell / Unqualifiziert)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS downsell_reason TEXT;
