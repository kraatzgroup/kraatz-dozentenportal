-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow public profile reading" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin profile deletion" ON public.profiles;

-- Drop existing function
DROP FUNCTION IF EXISTS public.is_admin_service();

-- Create new non-recursive policies
CREATE POLICY "Public profiles are viewable"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin profile creation"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role' = 'admin')
  )
);

CREATE POLICY "Profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role' = 'admin')
    AND id != auth.uid()
  )
);

CREATE POLICY "Admin profile deletion"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role' = 'admin')
    AND id != auth.uid()
  )
);