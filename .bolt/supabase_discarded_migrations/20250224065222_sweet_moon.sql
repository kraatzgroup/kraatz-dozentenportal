-- Drop existing problematic policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Create new simplified policies
CREATE POLICY "Allow profile read access"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Create policy for profile creation
CREATE POLICY "Allow admin profile creation"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
  )
);

-- Create policy for profile updates
CREATE POLICY "Allow admin profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
  )
);

-- Create policy for profile deletion
CREATE POLICY "Allow admin profile deletion"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
  )
  AND id != auth.uid()
);

-- Add hidden column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;