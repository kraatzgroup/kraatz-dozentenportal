-- Create zoom-backgrounds storage bucket for participant Zoom backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('zoom-backgrounds', 'zoom-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload zoom backgrounds
CREATE POLICY "Admins can upload zoom backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zoom-backgrounds' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR 'admin' = ANY(profiles.additional_roles))
  )
);

-- Allow admins to update zoom backgrounds
CREATE POLICY "Admins can update zoom backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'zoom-backgrounds' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR 'admin' = ANY(profiles.additional_roles))
  )
);

-- Allow admins to delete zoom backgrounds
CREATE POLICY "Admins can delete zoom backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'zoom-backgrounds' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR 'admin' = ANY(profiles.additional_roles))
  )
);

-- Allow public read access to zoom backgrounds
CREATE POLICY "Public can view zoom backgrounds"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'zoom-backgrounds');
