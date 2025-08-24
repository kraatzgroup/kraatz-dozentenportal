-- Drop all existing policies first
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write" ON public.profiles;
DROP POLICY IF EXISTS "folders_access" ON public.folders;
DROP POLICY IF EXISTS "files_access" ON public.files;
DROP POLICY IF EXISTS "messages_access" ON public.messages;
DROP POLICY IF EXISTS "storage_access" ON storage.objects;

-- Create new policies using is_user_admin()
CREATE POLICY "profiles_read_new"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_write_new"
ON public.profiles
FOR ALL
TO authenticated
USING (
  id = auth.uid() OR
  (public.is_user_admin() AND id != auth.uid())
)
WITH CHECK (
  id = auth.uid() OR
  (public.is_user_admin() AND id != auth.uid())
);

-- Folder policies
CREATE POLICY "folders_access_new"
ON public.folders
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR public.is_user_admin()
)
WITH CHECK (
  user_id = auth.uid() OR public.is_user_admin()
);

-- File policies
CREATE POLICY "files_access_new"
ON public.files
FOR ALL
TO authenticated
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR
  public.is_user_admin()
)
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR
  public.is_user_admin()
);

-- Message policies
CREATE POLICY "messages_access_new"
ON public.messages
FOR ALL
TO authenticated
USING (
  sender_id = auth.uid() OR
  receiver_id = auth.uid() OR
  public.is_user_admin()
)
WITH CHECK (
  sender_id = auth.uid() OR
  public.is_user_admin()
);

-- Storage policies
CREATE POLICY "storage_access_new"
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
  public.is_user_admin()
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
  public.is_user_admin()
);