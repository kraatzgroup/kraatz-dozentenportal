-- Drop existing policies
DROP POLICY IF EXISTS "storage_access_policy" ON storage.objects;
DROP POLICY IF EXISTS "files_access_policy" ON files;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Drop existing function to avoid any dependency issues
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Create simple profile policies without recursion
CREATE POLICY "allow_read_profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_create_own_profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can only create their own profile
  auth.uid() = id
);

CREATE POLICY "allow_update_profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Or if they're an admin (direct check) updating someone else's profile
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND id != auth.uid()
  )
);

CREATE POLICY "allow_delete_profiles"
ON profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles (except their own)
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  AND id != auth.uid()
);

-- Create simple file policies
CREATE POLICY "allow_file_access"
ON files
FOR ALL
TO authenticated
USING (
  -- Users can access their own files
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR
  -- Or if they're an admin
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Create simple storage policies
CREATE POLICY "allow_storage_access"
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
  OR
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
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
  OR
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);