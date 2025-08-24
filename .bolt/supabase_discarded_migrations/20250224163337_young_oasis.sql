-- Drop all existing policies and functions
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "files_access" ON files;
DROP POLICY IF EXISTS "storage_access" ON storage.objects;
DROP FUNCTION IF EXISTS auth.check_is_admin();

-- Create a service role function to check admin status
CREATE OR REPLACE FUNCTION auth.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN public.profiles p ON u.id = p.id
    WHERE u.id = user_id
    AND p.role = 'admin'
  );
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
  -- Users can only create their own profile initially
  auth.uid() = id
);

CREATE POLICY "profiles_update"
ON profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Or if they're an admin updating someone else's profile
  (auth.is_admin(auth.uid()) AND id != auth.uid())
);

CREATE POLICY "profiles_delete"
ON profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles (except their own)
  auth.is_admin(auth.uid()) AND id != auth.uid()
);

-- Folder policies
CREATE POLICY "folders_access"
ON folders
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR auth.is_admin(auth.uid())
)
WITH CHECK (
  user_id = auth.uid() OR auth.is_admin(auth.uid())
);

-- File policies
CREATE POLICY "files_access"
ON files
FOR ALL
TO authenticated
USING (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR auth.is_admin(auth.uid())
)
WITH CHECK (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR auth.is_admin(auth.uid())
);

-- Message policies
CREATE POLICY "messages_access"
ON messages
FOR ALL
TO authenticated
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR auth.is_admin(auth.uid())
)
WITH CHECK (
  sender_id = auth.uid()
  OR auth.is_admin(auth.uid())
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
  OR
  (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR auth.is_admin(auth.uid())
)
WITH CHECK (
  (
    bucket_id = 'files'
    AND substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  )
  OR
  (
    bucket_id = 'avatars'
    AND auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  )
  OR auth.is_admin(auth.uid())
);