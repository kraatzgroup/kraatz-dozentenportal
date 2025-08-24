-- Drop all existing policies
DROP POLICY IF EXISTS "policy_profiles_select_20250224" ON profiles;
DROP POLICY IF EXISTS "policy_profiles_insert_20250224" ON profiles;
DROP POLICY IF EXISTS "policy_profiles_update_20250224" ON profiles;
DROP POLICY IF EXISTS "policy_profiles_delete_20250224" ON profiles;
DROP POLICY IF EXISTS "policy_files_all_20250224" ON files;
DROP POLICY IF EXISTS "policy_storage_all_20250224" ON storage.objects;

-- Create a secure function to check admin status that avoids recursion
CREATE OR REPLACE FUNCTION auth.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON u.id = p.id
    WHERE u.id = auth.uid()
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
  (auth.check_is_admin() AND id != auth.uid())
);

CREATE POLICY "profiles_delete"
ON profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles (except their own)
  auth.check_is_admin() AND id != auth.uid()
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
  OR auth.check_is_admin()
)
WITH CHECK (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR auth.check_is_admin()
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
  OR auth.check_is_admin()
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
  OR auth.check_is_admin()
);