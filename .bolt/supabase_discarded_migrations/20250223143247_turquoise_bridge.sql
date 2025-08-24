/*
  # Fix profile policies recursion

  1. Changes
    - Drop existing policies that cause recursion
    - Create new policies with non-recursive checks
    - Use role-based checks without self-referencing
    
  2. Security
    - Maintain RLS protection
    - Keep admin-only access for sensitive operations
    - Prevent privilege escalation
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can modify profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can remove profiles" ON public.profiles;

-- Create new policies with non-recursive checks
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- For insert, we'll check the inserting user's role directly
CREATE POLICY "Admins can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- For update, use a similar direct role check
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND id != auth.uid() -- Prevent admin from modifying themselves
);

-- For delete, maintain the same pattern
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND id != auth.uid() -- Prevent admin from deleting themselves
);