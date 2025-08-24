-- Drop existing problematic policies
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Admin users can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admin can update others" ON public.profiles;
DROP POLICY IF EXISTS "Admin users can delete profiles" ON public.profiles;

-- Drop existing function
DROP FUNCTION IF EXISTS public.is_admin_safe();

-- Create a new admin check function that uses a service role
CREATE OR REPLACE FUNCTION public.is_admin_service()
RETURNS boolean AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role
  FROM auth.users
  JOIN public.profiles ON auth.users.id = profiles.id
  WHERE auth.users.id = auth.uid();
  
  RETURN _role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new non-recursive policies
CREATE POLICY "Allow public profile reading"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin profile creation"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.jwt()->>'role' = 'authenticated' AND
  (
    SELECT role FROM auth.users
    WHERE id = auth.uid()
  ) = 'admin'
);

CREATE POLICY "Allow profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  id = auth.uid()
  OR
  -- Admins can update other profiles
  (
    SELECT role FROM auth.users
    WHERE id = auth.uid()
  ) = 'admin' AND id != auth.uid()
);

CREATE POLICY "Allow admin profile deletion"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  (
    SELECT role FROM auth.users
    WHERE id = auth.uid()
  ) = 'admin' AND id != auth.uid()
);