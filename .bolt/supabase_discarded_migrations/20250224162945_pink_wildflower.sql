-- Drop existing policies and functions
DROP POLICY IF EXISTS "read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "read_folders" ON public.folders;
DROP POLICY IF EXISTS "insert_folders" ON public.folders;
DROP POLICY IF EXISTS "update_folders" ON public.folders;
DROP POLICY IF EXISTS "delete_folders" ON public.folders;
DROP POLICY IF EXISTS "read_files" ON public.files;
DROP POLICY IF EXISTS "insert_files" ON public.files;
DROP POLICY IF EXISTS "delete_files" ON public.files;
DROP POLICY IF EXISTS "read_messages" ON public.messages;
DROP POLICY IF EXISTS "insert_messages" ON public.messages;
DROP POLICY IF EXISTS "update_messages" ON public.messages;
DROP POLICY IF EXISTS "manage_files_storage" ON storage.objects;
DROP POLICY IF EXISTS "manage_avatars_storage" ON storage.objects;
DROP FUNCTION IF EXISTS public.get_user_role;

-- Create a cache table for roles
CREATE TABLE IF NOT EXISTS user_role_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_role_cache_user_id_idx ON user_role_cache(user_id);

-- Function to get role from cache
CREATE OR REPLACE FUNCTION get_cached_role(uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cached_role text;
BEGIN
  -- Try to get from cache first
  SELECT role INTO cached_role
  FROM user_role_cache
  WHERE user_id = uid;
  
  -- If not in cache, get from profiles and cache it
  IF cached_role IS NULL THEN
    SELECT role INTO cached_role
    FROM profiles
    WHERE id = uid;
    
    IF cached_role IS NOT NULL THEN
      INSERT INTO user_role_cache (user_id, role)
      VALUES (uid, cached_role)
      ON CONFLICT (user_id) 
      DO UPDATE SET role = cached_role, updated_at = now();
    END IF;
  END IF;
  
  RETURN cached_role;
END;
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN get_cached_role(auth.uid()) = 'admin';
END;
$$;

-- Trigger to update cache when profile changes
CREATE OR REPLACE FUNCTION update_role_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_role_cache (user_id, role)
  VALUES (NEW.id, NEW.role)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = NEW.role, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_role_cache_trigger
AFTER INSERT OR UPDATE OF role ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_role_cache();

-- Profile Policies
CREATE POLICY "allow_read_all_profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_insert_own_profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR
  (get_cached_role(auth.uid()) = 'admin' AND id != auth.uid())
);

CREATE POLICY "allow_admin_delete_profile"
ON profiles FOR DELETE
TO authenticated
USING (
  get_cached_role(auth.uid()) = 'admin' AND id != auth.uid()
);

-- Folder Policies
CREATE POLICY "allow_folder_access"
ON folders FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR get_cached_role(auth.uid()) = 'admin'
)
WITH CHECK (
  user_id = auth.uid() OR get_cached_role(auth.uid()) = 'admin'
);

-- File Policies
CREATE POLICY "allow_file_access"
ON files FOR ALL
TO authenticated
USING (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR
  get_cached_role(auth.uid()) = 'admin'
)
WITH CHECK (
  folder_id IN (SELECT id FROM folders WHERE user_id = auth.uid()) OR
  get_cached_role(auth.uid()) = 'admin'
);

-- Message Policies
CREATE POLICY "allow_message_access"
ON messages FOR ALL
TO authenticated
USING (
  sender_id = auth.uid() OR
  receiver_id = auth.uid() OR
  get_cached_role(auth.uid()) = 'admin'
)
WITH CHECK (
  sender_id = auth.uid() OR
  get_cached_role(auth.uid()) = 'admin'
);

-- Storage Policies
CREATE POLICY "allow_storage_access"
ON storage.objects FOR ALL
TO authenticated
USING (
  (
    bucket_id = 'files' AND
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  ) OR
  (
    bucket_id = 'avatars' AND
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  ) OR
  get_cached_role(auth.uid()) = 'admin'
)
WITH CHECK (
  (
    bucket_id = 'files' AND
    substring(name from '^([^/]+)') IN (
      SELECT id::text FROM folders WHERE user_id = auth.uid()
    )
  ) OR
  (
    bucket_id = 'avatars' AND
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1]
  ) OR
  get_cached_role(auth.uid()) = 'admin'
);

-- Initial population of cache
INSERT INTO user_role_cache (user_id, role)
SELECT id, role FROM profiles
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role, updated_at = now();