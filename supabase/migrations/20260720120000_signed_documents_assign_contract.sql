/*
  # Zuordnung: Vertragsdokumente ↔ Teilnehmer-Verträge

  - signed_documents bekommt contract_id + teilnehmer_id (nullable), sodass ein
    Vertrag (contracts) MEHRERE Vertragsdokumente (signed_documents) haben kann.
  - RLS: Verwaltung darf contracts lesen (bisher nur admin/dozent), damit der
    Zuordnen-Dialog für Admin & Verwaltung funktioniert.
*/

-- ============================================
-- signed_documents: Zuordnung
-- ============================================
ALTER TABLE public.signed_documents
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teilnehmer_id UUID REFERENCES public.teilnehmer(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_signed_documents_contract_id ON public.signed_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_signed_documents_teilnehmer_id ON public.signed_documents(teilnehmer_id);

-- ============================================
-- contracts: Verwaltung (und admin via additional_roles) dürfen lesen
-- ============================================
DROP POLICY IF EXISTS "adminverw view contracts" ON public.contracts;
CREATE POLICY "adminverw view contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (public.is_admin_or_verwaltung());
