/*
  # Fix admin deletion policies

  1. Changes
    - Create a new admin check function with SECURITY DEFINER
    - Simplify policies to avoid recursion
    - Ensure proper cascading deletes
    - Fix auth.users policies

  2. Security
    - Maintain admin-only access for user management
    - Prevent admins from modifying their own profile
    - Allow all authenticated users to read profiles
*/

-- Create a more robust admin check function
CREATE OR REPLACE FUNCTION public.is_admin_v2()
RETURNS boolean AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN _role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage users" ON auth.users;

-- Create new simplified policies for profiles
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
  public.is_admin_v2()
);

CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_admin_v2() AND
  id != auth.uid()
);

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin_v2() AND
  id != auth.uid()
);

-- Create new policy for auth.users
CREATE POLICY "Admins can manage users"
ON auth.users
FOR ALL
TO authenticated
USING (
  public.is_admin_v2()
);

-- Ensure RLS is enabled
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

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