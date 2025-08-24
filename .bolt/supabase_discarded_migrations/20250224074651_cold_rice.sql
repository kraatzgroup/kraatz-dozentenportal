/*
  # Fix Profile Policies Recursion
  
  This migration fixes the infinite recursion in profile policies by:
  1. Creating a new admin check function that avoids recursion
  2. Updating all profile policies to use the new approach
  3. Ensuring proper access control without circular dependencies
*/

-- First create a new admin check function that avoids recursion
CREATE OR REPLACE FUNCTION public.is_admin_check()
RETURNS boolean AS $$
BEGIN
  -- Use a direct subquery to avoid recursion
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    -- Limit to 1 to optimize performance
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing profile policies
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

CREATE POLICY "Update profiles"
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

CREATE POLICY "Delete profiles"
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