/*
  # Final Fix for Profile Policies
  
  This migration:
  1. Creates a materialized view for admin roles
  2. Creates a function to refresh the view
  3. Creates triggers to keep the view updated
  4. Implements non-recursive policies
*/

-- Drop all existing policies and functions
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "admin_profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "admin_profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "admin_profiles_delete" ON public.profiles;
DROP FUNCTION IF EXISTS auth.is_admin();

-- Create materialized view for admin roles
CREATE MATERIALIZED VIEW admin_roles AS
SELECT id, role = 'admin' as is_admin
FROM profiles;

CREATE INDEX admin_roles_id_idx ON admin_roles(id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY admin_roles;
  RETURN NULL;
END;
$$;

-- Create trigger to refresh the view
CREATE TRIGGER refresh_admin_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_admin_roles();

-- Create base policies for profiles
CREATE POLICY "allow_read_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_self_profile"
ON public.profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Create admin policies using materialized view
CREATE POLICY "admin_manage_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
  AND id != auth.uid()
);

-- Update other table policies
CREATE POLICY "allow_folder_access"
ON public.folders
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
)
WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "allow_file_access"
ON public.files
FOR ALL
TO authenticated
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
)
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "allow_message_access"
ON public.messages
FOR ALL
TO authenticated
USING (
  sender_id = auth.uid() OR
  receiver_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
)
WITH CHECK (
  sender_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- Storage policies
CREATE POLICY "allow_storage_access"
ON storage.objects
FOR ALL
TO authenticated
USING (
  (bucket_id = 'files' AND
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  ) OR
  (bucket_id = 'avatars' AND
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  ) OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
)
WITH CHECK (
  (bucket_id = 'files' AND
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  ) OR
  (bucket_id = 'avatars' AND
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  ) OR
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- Initial refresh of the materialized view
REFRESH MATERIALIZED VIEW admin_roles;