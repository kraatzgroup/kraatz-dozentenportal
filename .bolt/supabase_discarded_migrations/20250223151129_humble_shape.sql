/*
  # Fix admin policies for user management

  1. Changes
    - Drop all existing profile policies
    - Create simplified, non-recursive policies for admin operations
    - Add explicit admin check function for cleaner policies
    - Ensure proper cascading deletes for related tables

  2. Security
    - Maintain admin-only access for user management
    - Prevent admins from modifying their own profile
    - Allow all authenticated users to read profiles
*/

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all existing profile policies
DROP POLICY IF EXISTS "Profiles are viewable by users" ON public.profiles;
DROP POLICY IF EXISTS "Admin create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin delete profiles" ON public.profiles;

-- Create new simplified policies
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_admin() AND
  id != auth.uid() -- Prevent admin from modifying themselves
);

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin() AND
  id != auth.uid() -- Prevent admin from deleting themselves
);

-- Update auth.users policies
DROP POLICY IF EXISTS "Admins can manage users" ON auth.users;

CREATE POLICY "Admins can manage users"
ON auth.users
FOR ALL
TO authenticated
USING (
  public.is_admin()
);

-- Ensure proper cascading deletes for all related tables
ALTER TABLE public.folders
DROP CONSTRAINT IF EXISTS folders_user_id_fkey,
ADD CONSTRAINT folders_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.files
DROP CONSTRAINT IF EXISTS files_uploaded_by_fkey,
ADD CONSTRAINT files_uploaded_by_fkey
  FOREIGN KEY (uploaded_by)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE,
DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey,
ADD CONSTRAINT messages_receiver_id_fkey
  FOREIGN KEY (receiver_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;