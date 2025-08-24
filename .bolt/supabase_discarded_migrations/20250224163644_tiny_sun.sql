-- First create a new admin check function with a temporary name
CREATE OR REPLACE FUNCTION public.is_admin_new()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "folders_access" ON folders;
DROP POLICY IF EXISTS "files_access" ON files;
DROP POLICY IF EXISTS "messages_access" ON messages;
DROP POLICY IF EXISTS "storage_access" ON storage.objects;

-- Create new policies using the new function
CREATE POLICY "profiles_read"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id OR public.is_admin_new()
);

CREATE POLICY "profiles_update"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR (public.is_admin_new() AND id != auth.uid())
);

CREATE POLICY "profiles_delete"
ON profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin_new() AND id != auth.uid()
);

-- Folder policies
CREATE POLICY "folders_access"
ON folders
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin_new()
)
WITH CHECK (
  user_id = auth.uid() OR public.is_admin_new()
);

-- File policies
CREATE POLICY "files_access"
ON files
FOR ALL
TO authenticated
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin_new()
)
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin_new()
);

-- Message policies
CREATE POLICY "messages_access"
ON messages
FOR ALL
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR public.is_admin_new()
)
WITH CHECK (
  sender_id = auth.uid()
  OR public.is_admin_new()
);

-- Storage policies
CREATE POLICY "storage_access"
ON storage.objects
FOR ALL
TO authenticated
USING (
  (
    bucket_id = 'files'
    AND substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  )
  OR (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR public.is_admin_new()
)
WITH CHECK (
  (
    bucket_id = 'files'
    AND substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  )
  OR (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR public.is_admin_new()
);

-- Now we can safely drop the old function and rename the new one
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
ALTER FUNCTION public.is_admin_new() RENAME TO is_admin;