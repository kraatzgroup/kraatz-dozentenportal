-- Drop all existing policies
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "folders_access" ON folders;
DROP POLICY IF EXISTS "files_access" ON files;
DROP POLICY IF EXISTS "messages_access" ON messages;
DROP POLICY IF EXISTS "storage_access" ON storage.objects;

-- Drop all existing admin check functions to start fresh
DROP FUNCTION IF EXISTS auth.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_user_admin();
DROP FUNCTION IF EXISTS public.check_admin_role();
DROP FUNCTION IF EXISTS auth.check_is_admin();

-- Create a simple, direct admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role = 'admin'
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Profile policies
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
  auth.uid() = id OR public.is_admin()
);

CREATE POLICY "profiles_update"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR (public.is_admin() AND id != auth.uid())
);

CREATE POLICY "profiles_delete"
ON profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin() AND id != auth.uid()
);

-- Folder policies
CREATE POLICY "folders_access"
ON folders
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin()
)
WITH CHECK (
  user_id = auth.uid() OR public.is_admin()
);

-- File policies
CREATE POLICY "files_access"
ON files
FOR ALL
TO authenticated
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin()
)
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin()
);

-- Message policies
CREATE POLICY "messages_access"
ON messages
FOR ALL
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  sender_id = auth.uid()
  OR public.is_admin()
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
  OR public.is_admin()
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
  OR public.is_admin()
);