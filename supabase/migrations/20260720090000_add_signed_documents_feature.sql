/*
  # Feature "Verträge" (PDF-Signatur) für Admin & Verwaltung

  Neue Tabellen:
  - signed_documents: hochgeladene PDFs, die signiert werden (Original + signierte Version)
  - saved_signatures: zuletzt genutzte Unterschriften (PNG) pro User
  - saved_stamps:     zuletzt genutzte Stempel (PDF) pro User

  Hinweis: Tabellenname "contracts" ist bereits durch die Teilnehmer-Verträge
  belegt, daher "signed_documents".

  Zugriff (RLS): nur User mit Rolle admin ODER verwaltung
  (role IN (...) ODER additional_roles && ARRAY[...]).
*/

-- ============================================
-- Helper: prüft admin/verwaltung anhand role + additional_roles
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin_or_verwaltung()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'verwaltung')
        OR p.additional_roles && ARRAY['admin', 'verwaltung']::text[]
      )
  );
$$;

-- ============================================
-- signed_documents
-- ============================================
CREATE TABLE IF NOT EXISTS public.signed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  original_file_path TEXT NOT NULL,
  signed_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signed_documents_uploaded_by ON public.signed_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_signed_documents_status ON public.signed_documents(status);
CREATE INDEX IF NOT EXISTS idx_signed_documents_created_at ON public.signed_documents(created_at DESC);

-- ============================================
-- saved_signatures
-- ============================================
CREATE TABLE IF NOT EXISTS public.saved_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_signatures_user_id ON public.saved_signatures(user_id, created_at DESC);

-- ============================================
-- saved_stamps
-- ============================================
CREATE TABLE IF NOT EXISTS public.saved_stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_stamps_user_id ON public.saved_stamps(user_id, created_at DESC);

-- ============================================
-- updated_at trigger für signed_documents
-- ============================================
CREATE OR REPLACE FUNCTION public.set_signed_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_signed_documents_updated_at ON public.signed_documents;
CREATE TRIGGER trg_signed_documents_updated_at
  BEFORE UPDATE ON public.signed_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_signed_documents_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.signed_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_stamps ENABLE ROW LEVEL SECURITY;

-- signed_documents: admin/verwaltung dürfen alles
DROP POLICY IF EXISTS "adminverw manage signed_documents" ON public.signed_documents;
CREATE POLICY "adminverw manage signed_documents" ON public.signed_documents
  FOR ALL TO authenticated
  USING (public.is_admin_or_verwaltung())
  WITH CHECK (public.is_admin_or_verwaltung());

-- saved_signatures: admin/verwaltung, nur eigene Einträge
DROP POLICY IF EXISTS "adminverw manage own signatures" ON public.saved_signatures;
CREATE POLICY "adminverw manage own signatures" ON public.saved_signatures
  FOR ALL TO authenticated
  USING (public.is_admin_or_verwaltung() AND user_id = auth.uid())
  WITH CHECK (public.is_admin_or_verwaltung() AND user_id = auth.uid());

-- saved_stamps: admin/verwaltung, nur eigene Einträge
DROP POLICY IF EXISTS "adminverw manage own stamps" ON public.saved_stamps;
CREATE POLICY "adminverw manage own stamps" ON public.saved_stamps
  FOR ALL TO authenticated
  USING (public.is_admin_or_verwaltung() AND user_id = auth.uid())
  WITH CHECK (public.is_admin_or_verwaltung() AND user_id = auth.uid());

-- ============================================
-- Storage Buckets: signed-documents, signatures, stamps
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('signed-documents', 'signed-documents', true),
  ('signatures', 'signatures', true),
  ('stamps', 'stamps', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (admin/verwaltung)
DROP POLICY IF EXISTS "adminverw read vertraege buckets" ON storage.objects;
CREATE POLICY "adminverw read vertraege buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('signed-documents', 'signatures', 'stamps')
    AND public.is_admin_or_verwaltung()
  );

DROP POLICY IF EXISTS "adminverw insert vertraege buckets" ON storage.objects;
CREATE POLICY "adminverw insert vertraege buckets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('signed-documents', 'signatures', 'stamps')
    AND public.is_admin_or_verwaltung()
  );

DROP POLICY IF EXISTS "adminverw update vertraege buckets" ON storage.objects;
CREATE POLICY "adminverw update vertraege buckets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('signed-documents', 'signatures', 'stamps')
    AND public.is_admin_or_verwaltung()
  );

DROP POLICY IF EXISTS "adminverw delete vertraege buckets" ON storage.objects;
CREATE POLICY "adminverw delete vertraege buckets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('signed-documents', 'signatures', 'stamps')
    AND public.is_admin_or_verwaltung()
  );

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Verträge-Feature: signed_documents, saved_signatures, saved_stamps + Buckets erstellt';
END $$;
