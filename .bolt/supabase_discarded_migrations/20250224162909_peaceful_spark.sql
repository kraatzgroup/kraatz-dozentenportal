-- Drop existing policies
DROP POLICY IF EXISTS "profiles_read_new" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_new" ON public.profiles;
DROP POLICY IF EXISTS "folders_access_new" ON public.folders;
DROP POLICY IF EXISTS "files_access_new" ON public.files;
DROP POLICY IF EXISTS "messages_access_new" ON public.messages;
DROP POLICY IF EXISTS "storage_access_new" ON storage.objects;

-- Create a stable function for admin checks that avoids recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM profiles
  WHERE id = user_id
  LIMIT 1;
$$;

-- Profile policies
CREATE POLICY "read_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "insert_profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to create their own initial profile
  auth.uid() = id
);

CREATE POLICY "update_profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Admins can update other profiles
  (
    get_user_role(auth.uid()) = 'admin'
    AND id != auth.uid()
  )
);

CREATE POLICY "delete_profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  get_user_role(auth.uid()) = 'admin'
  AND id != auth.uid()
);

-- Folder policies
CREATE POLICY "read_folders"
ON public.folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "insert_folders"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "update_folders"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system)
  OR get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "delete_folders"
ON public.folders
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system)
  OR get_user_role(auth.uid()) = 'admin'
);

-- File policies
CREATE POLICY "read_files"
ON public.files
FOR SELECT
TO authenticated
USING (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "insert_files"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "delete_files"
ON public.files
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR get_user_role(auth.uid()) = 'admin'
);

-- Message policies
CREATE POLICY "read_messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "insert_messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "update_messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  receiver_id = auth.uid()
  OR get_user_role(auth.uid()) = 'admin'
);

-- Storage policies
CREATE POLICY "manage_files_storage"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'files'
  AND (
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR get_user_role(auth.uid()) = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'files'
  AND (
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
    OR get_user_role(auth.uid()) = 'admin'
  )
);

CREATE POLICY "manage_avatars_storage"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR get_user_role(auth.uid()) = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR get_user_role(auth.uid()) = 'admin'
  )
);