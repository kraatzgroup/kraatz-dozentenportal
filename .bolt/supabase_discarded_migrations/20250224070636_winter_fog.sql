-- Drop all existing profile policies
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile deletion" ON public.profiles;

-- Create new simplified policies that use auth.users metadata directly
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.jwt()->>'role' = 'authenticated'
);

CREATE POLICY "Allow profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own profile
  id = auth.uid()
  OR
  -- Or if they're an admin (but prevent admin from modifying themselves)
  (
    auth.jwt()->>'role' = 'authenticated'
    AND id != auth.uid()
  )
);

CREATE POLICY "Allow profile deletion"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  auth.jwt()->>'role' = 'authenticated'
  AND id != auth.uid()
);