/*
  # Fix database policies and access

  1. Changes
    - Drop all existing profile policies to start fresh
    - Create new non-recursive policies for profiles
    - Fix user management permissions
    - Ensure proper data access control
    
  2. Security
    - Maintain RLS protection
    - Implement proper admin checks
    - Prevent privilege escalation
*/

-- Drop all existing profile policies to start fresh
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Create base policy for reading profiles
CREATE POLICY "Profiles are viewable by users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Create admin-only policies using role-based checks
CREATE POLICY "Admin create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'admin'
  )
);

CREATE POLICY "Admin update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'admin'
  )
  AND id != auth.uid() -- Prevent admin from modifying themselves
);

CREATE POLICY "Admin delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'admin'
  )
  AND id != auth.uid() -- Prevent admin from deleting themselves
);

-- Ensure proper cascading deletes
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