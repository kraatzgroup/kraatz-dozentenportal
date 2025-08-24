-- First create a new admin check function with a temporary name
CREATE OR REPLACE FUNCTION public.is_admin_new()
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

-- Update all policies to use the new function
ALTER POLICY "storage_access" ON storage.objects
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

ALTER POLICY "files_access" ON files
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin_new()
)
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid())
  OR public.is_admin_new()
);

ALTER POLICY "folders_access" ON folders
USING (
  user_id = auth.uid() OR public.is_admin_new()
)
WITH CHECK (
  user_id = auth.uid() OR public.is_admin_new()
);

ALTER POLICY "messages_access" ON messages
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR public.is_admin_new()
)
WITH CHECK (
  sender_id = auth.uid()
  OR public.is_admin_new()
);

ALTER POLICY "profiles_update" ON profiles
USING (
  auth.uid() = id OR (public.is_admin_new() AND id != auth.uid())
);

ALTER POLICY "profiles_delete" ON profiles
USING (
  public.is_admin_new() AND id != auth.uid()
);

-- Now we can safely drop the old function and rename the new one
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
ALTER FUNCTION public.is_admin_new() RENAME TO is_admin;