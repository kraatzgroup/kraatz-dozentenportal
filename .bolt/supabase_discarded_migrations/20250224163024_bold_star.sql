-- Drop all existing policies and functions
DROP POLICY IF EXISTS "allow_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_admin_delete_profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_folder_access" ON public.folders;
DROP POLICY IF EXISTS "allow_file_access" ON public.files;
DROP POLICY IF EXISTS "allow_message_access" ON public.messages;
DROP POLICY IF EXISTS "allow_storage_access" ON storage.objects;
DROP FUNCTION IF EXISTS get_cached_role;
DROP FUNCTION IF EXISTS is_admin;
DROP FUNCTION IF EXISTS update_role_cache;
DROP TRIGGER IF EXISTS update_role_cache_trigger ON profiles;
DROP TABLE IF EXISTS user_role_cache;

-- Simple profile policies with direct role checks
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
  -- Allow users to create their own profile
  auth.uid() = id
);

CREATE POLICY "profiles_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own profile
  auth.uid() = id
  OR
  -- Or if they're an admin updating someone else's profile
  (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND profiles.id != auth.uid()
    )
  )
);

CREATE POLICY "profiles_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles (except their own)
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND profiles.id != auth.uid()
  )
);

-- Simple folder policies
CREATE POLICY "folders_all"
ON public.folders
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Simple file policies
CREATE POLICY "files_all"
ON public.files
FOR ALL
TO authenticated
USING (
  folder_id IN (
    SELECT id
    FROM folders
    WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  folder_id IN (
    SELECT id
    FROM folders
    WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Simple message policies
CREATE POLICY "messages_select"
ON public.messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "messages_insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
);

CREATE POLICY "messages_update"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  receiver_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Simple storage policies
CREATE POLICY "storage_all"
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
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
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
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);