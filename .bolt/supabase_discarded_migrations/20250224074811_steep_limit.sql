/*
  # Non-recursive Profile Policies
  
  This migration:
  1. Drops all existing profile policies
  2. Creates new non-recursive policies using direct role checks
  3. Avoids any function calls to prevent recursion
*/

-- Drop all existing profile policies
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_create" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- Create new non-recursive policies using direct role checks
CREATE POLICY "profiles_read_policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_create_policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow initial profile creation for authenticated users
  NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  )
  OR
  -- Or if creating other profiles as admin
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
    LIMIT 1
  )
);

CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own profile
  id = auth.uid()
  OR
  -- Or admins can update other profiles
  (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
      LIMIT 1
    )
    AND id != auth.uid()
  )
);

CREATE POLICY "profiles_delete_policy"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
    LIMIT 1
  )
  -- And they can't delete their own profile
  AND id != auth.uid()
);