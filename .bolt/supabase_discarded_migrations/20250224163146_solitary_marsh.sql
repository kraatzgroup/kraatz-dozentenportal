-- First create the new admin check function with a temporary name
CREATE OR REPLACE FUNCTION public.check_admin_role_new()
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

-- Drop existing storage policies
DROP POLICY IF EXISTS "storage_files_access" ON storage.objects;
DROP POLICY IF EXISTS "File operations" ON storage.objects;
DROP POLICY IF EXISTS "File management" ON storage.objects;

-- Create new storage policies using the new function
CREATE POLICY "storage_access_policy"
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
  OR public.check_admin_role_new()
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
  OR public.check_admin_role_new()
);

-- Drop existing file policies
DROP POLICY IF EXISTS "files_access" ON files;
DROP POLICY IF EXISTS "File management" ON files;

-- Create new file policies using the new function
CREATE POLICY "files_access_policy"
ON files
FOR ALL
TO authenticated
USING (
  folder_id IN (
    SELECT id FROM folders
    WHERE user_id = auth.uid()
  )
  OR uploaded_by = auth.uid()
  OR public.check_admin_role_new()
)
WITH CHECK (
  folder_id IN (
    SELECT id FROM folders
    WHERE user_id = auth.uid()
  )
  OR public.check_admin_role_new()
);

-- Now we can safely drop the old function
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Rename the new function to the standard name
ALTER FUNCTION public.check_admin_role_new() RENAME TO is_admin;