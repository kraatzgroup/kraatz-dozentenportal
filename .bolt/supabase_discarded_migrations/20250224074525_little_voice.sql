/*
  # Clean Transition Migration
  
  This migration:
  1. Creates new admin check function
  2. Updates dependent policies to use new function
  3. Safely drops old functions
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

-- Update all policies that depend on is_admin_v3 to use the new function
DO $$ 
BEGIN
  -- Update storage policies
  DROP POLICY IF EXISTS "Allow file operations" ON storage.objects;
  CREATE POLICY "Allow file operations"
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

  -- Update avatar policies
  DROP POLICY IF EXISTS "Avatar management" ON storage.objects;
  CREATE POLICY "Avatar management"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (
      auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1] OR
      public.is_admin_new()
    )
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    (
      auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1] OR
      public.is_admin_new()
    )
  );

  -- Now we can safely drop the old functions
  DROP FUNCTION IF EXISTS public.is_admin_v3();
  DROP FUNCTION IF EXISTS public.is_admin_v2();
  DROP FUNCTION IF EXISTS public.is_admin_service();
  DROP FUNCTION IF EXISTS public.is_admin_safe();
  DROP FUNCTION IF EXISTS public.is_admin_secure();
  
  -- Rename the new function to the standard name
  ALTER FUNCTION public.is_admin_new() RENAME TO is_admin;
END $$;