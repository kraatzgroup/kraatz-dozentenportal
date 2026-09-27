ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS teilnehmer_id UUID REFERENCES public.teilnehmer(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_teilnehmer_id
  ON public.leads(teilnehmer_id)
  WHERE teilnehmer_id IS NOT NULL;
