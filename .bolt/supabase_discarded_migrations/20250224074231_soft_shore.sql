/*
  # Clean Slate Migration
  
  This migration:
  1. Drops all existing policies
  2. Creates new secure admin check function
  3. Establishes clean base policies for all tables
  4. Sets up proper RLS for all tables
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow file uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow file downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow file deletions" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar deletions" ON storage.objects;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.is_admin_secure();
DROP FUNCTION IF EXISTS public.is_admin_v2();
DROP FUNCTION IF EXISTS public.is_admin_v3();
DROP FUNCTION IF EXISTS public.is_admin_service();
DROP FUNCTION IF EXISTS public.is_admin_safe();

-- Create a new secure admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Users can update own profile or admins can update others"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  (public.is_admin() AND id != auth.uid())
);

CREATE POLICY "Admins can delete other profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin() AND id != auth.uid());

-- Folders policies
CREATE POLICY "Users can view own folders"
ON public.folders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Users can create folders"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Users can update own folders"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system) OR public.is_admin()
);

CREATE POLICY "Users can delete own folders"
ON public.folders
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid() AND NOT is_system) OR public.is_admin()
);

-- Files policies
CREATE POLICY "Users can view own files"
ON public.files
FOR SELECT
TO authenticated
USING (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  ) OR public.is_admin()
);

CREATE POLICY "Users can upload files"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  ) OR public.is_admin()
);

CREATE POLICY "Users can delete own files"
ON public.files
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  folder_id IN (
    SELECT id FROM folders WHERE user_id = auth.uid()
  ) OR public.is_admin()
);

-- Messages policies
CREATE POLICY "Users can view own messages"
ON public.messages
FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (receiver_id = auth.uid());

-- Storage policies for files bucket
CREATE POLICY "Allow file operations"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'files' AND
  (
    -- Check folder ownership
    substring(name from '^([^/]+)') IN (
      SELECT id::text
      FROM folders
      WHERE user_id = auth.uid()
    ) OR public.is_admin()
  )
)
WITH CHECK (
  bucket_id = 'files' AND
  (
    substring(name from '^([^/]+)') IN (
      SELECT id::text
      FROM folders
      WHERE user_id = auth.uid()
    ) OR public.is_admin()
  )
);

-- Storage policies for avatars bucket
CREATE POLICY "Avatar management"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1] OR
    public.is_admin()
  )
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    auth.uid()::text = (regexp_match(name, '^([^/]+)'))[1] OR
    public.is_admin()
  )
);