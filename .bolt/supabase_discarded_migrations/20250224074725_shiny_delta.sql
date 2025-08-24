/*
  # Clean Profile Policies
  
  This migration:
  1. Drops all existing profile policies
  2. Creates a new admin check function
  3. Recreates all policies with clean names
*/

-- Drop all existing profile policies
DROP POLICY IF EXISTS "Read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admin profile deletion" ON public.profiles;

-- Create a new admin check function that avoids recursion
CREATE OR REPLACE FUNCTION public.is_admin_check()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new non-recursive policies with unique names
CREATE POLICY "profiles_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_create"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow creation if no profile exists for the user
  NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  )
  OR
  -- Or if the user is an admin (using direct check)
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
    LIMIT 1
  )
);

CREATE POLICY "profiles_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  id = auth.uid()
  OR
  -- Admins can update other profiles (using direct check)
  (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
      LIMIT 1
    )
    AND id != auth.uid()
  )
);

CREATE POLICY "profiles_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles (using direct check)
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
    LIMIT 1
  )
  -- And they can't delete their own profile
  AND id != auth.uid()
);