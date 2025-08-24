-- Drop all existing profile policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile deletion" ON public.profiles;

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
  role = 'admin'
);

CREATE POLICY "Profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  (role = 'admin' AND id != auth.uid())
);

CREATE POLICY "Admin profile deletion"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  role = 'admin' AND id != auth.uid()
);