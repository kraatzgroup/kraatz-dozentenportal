-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "allow_read_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_create_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_update_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_delete_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_file_access" ON files;
DROP POLICY IF EXISTS "allow_storage_access" ON storage.objects;

-- Create new policies with unique names and direct role checks
CREATE POLICY "policy_profiles_select_20250224"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "policy_profiles_insert_20250224"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can only create their own profile
  auth.uid() = id
);

CREATE POLICY "policy_profiles_update_20250224"
ON profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Or if they're an admin updating someone else's profile
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND id != auth.uid()
  )
);

CREATE POLICY "policy_profiles_delete_20250224"
ON profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles (except their own)
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  AND id != auth.uid()
);

-- File policies
CREATE POLICY "policy_files_all_20250224"
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

-- Storage policies
CREATE POLICY "policy_storage_all_20250224"
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