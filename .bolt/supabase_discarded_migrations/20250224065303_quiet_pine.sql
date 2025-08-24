-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow profile read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin profile deletion" ON public.profiles;

-- Create new simplified policies without recursion
CREATE POLICY "Public profiles are readable"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can create profiles"
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

CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
  )
  AND (
    -- Allow users to update their own profile
    id = auth.uid()
    OR
    -- Or if they're an admin (but prevent admin from modifying themselves)
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      AND id != auth.uid()
    )
  )
);

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
  )
  AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND id != auth.uid()
);

-- Add hidden column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'hidden'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hidden boolean DEFAULT false;
  END IF;
END $$;