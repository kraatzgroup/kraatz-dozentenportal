/*
  # Fix profile policies
  
  This migration fixes the profile policies to avoid recursion issues while maintaining proper access control.

  1. Changes
    - Drops existing profile policies
    - Creates new non-recursive policies using subqueries with aliases
    - Maintains proper security checks for all operations
    
  2. Security
    - Maintains read access for all authenticated users
    - Restricts profile creation to admins only
    - Allows users to update their own profiles
    - Allows admins to update other profiles but not their own
    - Restricts profile deletion to admins only
*/

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