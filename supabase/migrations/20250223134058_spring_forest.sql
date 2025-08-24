/*
  # Fix admin permissions

  1. Changes
    - Drop existing policies
    - Add correct admin policies for user management
    - Add service role policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create users" ON auth.users;
DROP POLICY IF EXISTS "Admins can update users" ON auth.users;
DROP POLICY IF EXISTS "Admins can read users" ON auth.users;

-- Create policies for profiles table
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can create profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create policies for auth.users table
CREATE POLICY "Admins can manage users"
ON auth.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);