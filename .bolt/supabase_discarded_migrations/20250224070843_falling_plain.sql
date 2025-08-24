-- Drop all existing profile policies
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile deletion" ON public.profiles;

-- Create new simplified policies
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
    FROM public.profiles AS admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
  )
);

CREATE POLICY "Profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own profile
  id = auth.uid()
  OR
  -- Or if they're an admin updating someone else's profile
  EXISTS (
    SELECT 1
    FROM public.profiles AS admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
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
    FROM public.profiles AS admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND id != auth.uid()
  )
);