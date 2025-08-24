-- Drop existing problematic policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update others" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;

-- Create a more robust admin check function that avoids recursion
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean AS $$
BEGIN
  -- Check the role directly from auth.users metadata
  RETURN (
    SELECT COALESCE(raw_app_meta_data->>'role', '') = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new non-recursive policies
CREATE POLICY "Public profiles are viewable"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin users can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_safe()
);

CREATE POLICY "Users can update own profile or admin can update others"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  (public.is_admin_safe() AND id != auth.uid())
);

CREATE POLICY "Admin users can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin_safe() AND id != auth.uid()
);