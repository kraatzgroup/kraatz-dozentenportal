/*
  # Fix admin profile update policy

  1. Changes
    - Drop existing admin profile update policy
    - Recreate policy with correct permissions
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- Recreate policy with correct permissions
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);