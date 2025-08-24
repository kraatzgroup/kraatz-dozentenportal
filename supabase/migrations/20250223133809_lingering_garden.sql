/*
  # Update delete permissions for admins

  1. Changes
    - Drop existing delete policies
    - Recreate delete policies with correct permissions

  2. Security
    - Only admins can delete users
    - Admins cannot delete themselves
    - Cascading deletes are handled automatically
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can delete users" ON auth.users;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete user folders" ON public.folders;
DROP POLICY IF EXISTS "Admins can delete user files" ON public.files;
DROP POLICY IF EXISTS "Admins can delete user messages" ON public.messages;

-- Recreate policies with correct permissions
CREATE POLICY "Admins can delete users"
ON auth.users
FOR DELETE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  ) AND
  id != auth.uid() -- Prevent admin from deleting themselves
);

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  ) AND
  id != auth.uid() -- Prevent admin from deleting themselves
);

CREATE POLICY "Admins can delete user folders"
ON public.folders
FOR DELETE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);

CREATE POLICY "Admins can delete user files"
ON public.files
FOR DELETE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);

CREATE POLICY "Admins can delete user messages"
ON public.messages
FOR DELETE TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);