/*
  # Create storage bucket for file uploads

  1. Changes
    - Create a new storage bucket named 'files'
    - Add storage policies for authenticated users
    
  2. Security
    - Enable policies for authenticated users to read and write files
    - Restrict access to own files and folders
*/

-- Create a new storage bucket
INSERT INTO storage.buckets (id, name)
VALUES ('files', 'files')
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'files' AND
  (auth.uid() IN (
    SELECT user_id FROM folders WHERE id = (
      SELECT folder_id FROM files WHERE storage.objects.name LIKE folder_id || '/%'
    )
  ) OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ))
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'files' AND
  (auth.uid() IN (
    SELECT user_id FROM folders WHERE id = (
      SELECT folder_id FROM files WHERE storage.objects.name LIKE folder_id || '/%'
    )
  ) OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ))
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'files' AND
  (auth.uid() IN (
    SELECT user_id FROM folders WHERE id = (
      SELECT folder_id FROM files WHERE storage.objects.name LIKE folder_id || '/%'
    )
  ) OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ))
);