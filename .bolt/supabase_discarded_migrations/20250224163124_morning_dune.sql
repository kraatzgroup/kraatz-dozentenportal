-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "storage_all" ON storage.objects;

-- Create admin check function
CREATE OR REPLACE FUNCTION public.check_admin_role()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new storage policies
CREATE POLICY "storage_files_access"
ON storage.objects
FOR ALL
TO authenticated
USING (
  (
    bucket_id = 'files'
    AND substring(name from '^([^/]+)') IN (
      SELECT id::text
      FROM folders
      WHERE user_id = auth.uid()
    )
  )
  OR (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR public.check_admin_role()
)
WITH CHECK (
  (
    bucket_id = 'files'
    AND substring(name from '^([^/]+)') IN (
      SELECT id::text
      FROM folders
      WHERE user_id = auth.uid()
    )
  )
  OR (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR public.check_admin_role()
);

-- Now we can safely drop the old function if it exists
DROP FUNCTION IF EXISTS public.is_admin();

-- Rename the new function to the standard name
ALTER FUNCTION public.check_admin_role() RENAME TO is_admin;