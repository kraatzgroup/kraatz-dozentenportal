/*
  # Clean Policy Transition
  
  This migration safely updates policies and functions by:
  1. Creating new admin check function
  2. Updating policies to use new function
  3. Safely dropping old functions after removing dependencies
*/

-- First create the new admin check function
CREATE OR REPLACE FUNCTION public.is_admin_new()
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update all policies that depend on is_admin_v3
DO $$ 
BEGIN
  -- Update storage policies
  DROP POLICY IF EXISTS "Allow file uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow file downloads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow file deletions" ON storage.objects;
  
  CREATE POLICY "File operations"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'files' AND
    (
      substring(name from '^([^/]+)') IN (
        SELECT id::text
        FROM folders
        WHERE user_id = auth.uid()
      ) OR public.is_admin_new()
    )
  )
  WITH CHECK (
    bucket_id = 'files' AND
    (
      substring(name from '^([^/]+)') IN (
        SELECT id::text
        FROM folders
        WHERE user_id = auth.uid()
      ) OR public.is_admin_new()
    )
  );

  -- Update file table policies
  DROP POLICY IF EXISTS "Allow file records creation" ON files;
  DROP POLICY IF EXISTS "Allow viewing files" ON files;
  DROP POLICY IF EXISTS "Allow file deletion" ON files;

  CREATE POLICY "File management"
  ON files
  FOR ALL
  TO authenticated
  USING (
    folder_id IN (
      SELECT id FROM folders
      WHERE user_id = auth.uid()
    ) OR uploaded_by = auth.uid() OR public.is_admin_new()
  )
  WITH CHECK (
    folder_id IN (
      SELECT id FROM folders
      WHERE user_id = auth.uid()
    ) OR public.is_admin_new()
  );

  -- Now we can safely drop the old functions
  DROP FUNCTION IF EXISTS public.is_admin_v3();
  DROP FUNCTION IF EXISTS public.is_admin_v2();
  DROP FUNCTION IF EXISTS public.is_admin();
  
  -- Rename the new function to the standard name
  ALTER FUNCTION public.is_admin_new() RENAME TO is_admin;
END $$;