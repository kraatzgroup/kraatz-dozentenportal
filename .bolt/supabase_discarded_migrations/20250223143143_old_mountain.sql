/*
  # Fix profile policies

  1. Changes
    - Drop existing conflicting policies
    - Recreate policies with correct permissions
    - Ensure no recursive checks
    
  2. Security
    - Maintain RLS protection
    - Keep admin-only access control
    - Prevent privilege escalation
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

-- Create new policies with clear permissions
CREATE POLICY "Public profiles are readable"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can modify profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) AND
  id != auth.uid() -- Prevent admin from modifying themselves
);

CREATE POLICY "Only admins can remove profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) AND
  id != auth.uid() -- Prevent admin from deleting themselves
);