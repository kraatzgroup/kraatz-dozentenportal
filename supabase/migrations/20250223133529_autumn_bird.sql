/*
  # Add admin delete permissions

  1. Changes
    - Add policy to allow admins to delete users from auth.users table
    - Add policy to allow admins to delete profiles

  2. Security
    - Only admins can delete users
    - Cascading delete will handle related data due to existing foreign key constraints
*/

-- Allow admins to delete users from auth.users
CREATE POLICY "Admins can delete users"
ON auth.users
FOR DELETE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  ) AND
  id != auth.uid() -- Prevent admin from deleting themselves
);ich h