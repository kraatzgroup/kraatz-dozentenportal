-- Create invoices storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to invoices bucket
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Allow authenticated users to update their own invoices
CREATE POLICY "Authenticated users can update invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices');

-- Allow authenticated users to delete invoices
CREATE POLICY "Authenticated users can delete invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoices');

-- Allow public read access to invoices (for PDF preview)
CREATE POLICY "Public read access to invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');
