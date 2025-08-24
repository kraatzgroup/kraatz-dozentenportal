-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow profile reading" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile deletion" ON public.profiles;

-- Create a function to check admin status without recursion
CREATE OR REPLACE FUNCTION is_admin_check()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create non-recursive policies
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_check()
);

CREATE POLICY "Users can update own profile or admins can update others"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  (is_admin_check() AND id != auth.uid())
);

CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  is_admin_check() AND id != auth.uid()
);