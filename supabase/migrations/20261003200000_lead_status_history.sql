-- Customer-Journey-Historie: jede Statusänderung eines Leads wird protokolliert
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id BIGSERIAL PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead
  ON public.lead_status_history (lead_id, changed_at);

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read lead history"
  ON public.lead_status_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert lead history"
  ON public.lead_status_history FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON public.lead_status_history TO authenticated;
GRANT USAGE ON SEQUENCE lead_status_history_id_seq TO authenticated;
