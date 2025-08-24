/*
  # Fix Profile Policies
  
  This migration:
  1. Drops all existing policies
  2. Creates new non-recursive policies using direct role checks
  3. Ensures proper access control without any circular dependencies
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow_create_profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow_delete_profiles" ON public.profiles;

-- Create new non-recursive policies
CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to create their own initial profile
  auth.uid() = id
);

CREATE POLICY "profiles_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own profile
  auth.uid() = id
);

CREATE POLICY "profiles_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (false); -- Disable direct deletion

-- Create a secure function for admin checks
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    JOIN public.profiles ON auth.users.id = profiles.id
    WHERE auth.users.id = auth.uid()
    AND profiles.role = 'admin'
  );
$$;

-- Create admin-specific policies
CREATE POLICY "admin_profiles_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.is_admin()
);

CREATE POLICY "admin_profiles_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.is_admin() AND id != auth.uid()
);

CREATE POLICY "admin_profiles_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  auth.is_admin() AND id != auth.uid()
);

-- Update other policies to use the new admin check
CREATE POLICY "folders_select"
ON public.folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR auth.is_admin()
);

CREATE POLICY "folders_insert"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR auth.is_admin()
);

CREATE POLICY "folders_update"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system) OR auth.is_admin()
);

CREATE POLICY "folders_delete"
ON public.folders
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system) OR auth.is_admin()
);

CREATE POLICY "files_select"
ON public.files
FOR SELECT
TO authenticated
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR auth.is_admin()
);

CREATE POLICY "files_insert"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR auth.is_admin()
);

CREATE POLICY "files_delete"
ON public.files
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR auth.is_admin()
);

CREATE POLICY "messages_select"
ON public.messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR auth.is_admin()
);

CREATE POLICY "messages_insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  receiver_id = auth.uid()
  OR auth.is_admin()
);

-- Storage policies
CREATE POLICY "storage_files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'files'
  AND (
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR auth.is_admin()
  )
)
WITH CHECK (
  bucket_id = 'files'
  AND (
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR auth.is_admin()
  )
);

CREATE POLICY "storage_avatars"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR auth.is_admin()
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR auth.is_admin()
  )
);