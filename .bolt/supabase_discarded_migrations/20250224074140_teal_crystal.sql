/*
  # Fix profile policies recursion

  This migration fixes the infinite recursion issue in profile policies by:
  1. Creating a secure admin check function
  2. Dropping existing problematic policies
  3. Creating new non-recursive policies
*/

-- Create a secure admin check function
CREATE OR REPLACE FUNCTION public.is_admin_secure()
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the role directly from a subquery to avoid recursion
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile deletion" ON public.profiles;

-- Create new non-recursive policies
CREATE POLICY "Read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_secure()
);

CREATE POLICY "Update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  (public.is_admin_secure() AND id != auth.uid())
);

CREATE POLICY "Delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin_secure() AND id != auth.uid()
);