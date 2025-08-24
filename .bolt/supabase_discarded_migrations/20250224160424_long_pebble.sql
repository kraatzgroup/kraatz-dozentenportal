/*
  # Fix All Policies
  
  This migration:
  1. Drops all existing policies
  2. Creates new non-recursive policies for all tables
  3. Uses direct role checks without functions
  4. Ensures proper access control without circular dependencies
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "profiles_read_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_create_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Profile policies
CREATE POLICY "allow_read_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_create_profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow initial profile creation
  auth.uid() = id
  OR
  -- Or admin creating other profiles
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      SELECT role FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ) = 'admin'
  )
);

CREATE POLICY "allow_update_profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Admins can update other profiles
  (
    (
      SELECT role FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ) = 'admin'
    AND id != auth.uid()
  )
);

CREATE POLICY "allow_delete_profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
  AND id != auth.uid()
);

-- Folder policies
CREATE POLICY "allow_read_folders"
ON public.folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

CREATE POLICY "allow_create_folders"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

CREATE POLICY "allow_update_folders"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system)
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

CREATE POLICY "allow_delete_folders"
ON public.folders
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system)
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

-- File policies
CREATE POLICY "allow_read_files"
ON public.files
FOR SELECT
TO authenticated
USING (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

CREATE POLICY "allow_create_files"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

CREATE POLICY "allow_delete_files"
ON public.files
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  )
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

-- Message policies
CREATE POLICY "allow_read_messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR
  receiver_id = auth.uid()
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

CREATE POLICY "allow_create_messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "allow_update_messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  receiver_id = auth.uid()
  OR
  (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin'
);

-- Storage policies
CREATE POLICY "allow_manage_files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'files'
  AND
  (
    -- Check folder ownership
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders
      WHERE user_id = auth.uid()
    )
    OR
    (
      SELECT role FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ) = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'files'
  AND
  (
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders
      WHERE user_id = auth.uid()
    )
    OR
    (
      SELECT role FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ) = 'admin'
  )
);

CREATE POLICY "allow_manage_avatars"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars'
  AND
  (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    (
      SELECT role FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ) = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND
  (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
    OR
    (
      SELECT role FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ) = 'admin'
  )
);