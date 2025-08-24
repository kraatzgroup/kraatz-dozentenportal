-- Drop existing problematic policies
DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Create base policy for reading profiles
CREATE POLICY "Allow profile reading"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Create policy for profile creation
CREATE POLICY "Allow profile creation"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles AS admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
  )
);

-- Create policy for profile updates
CREATE POLICY "Allow profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow users to update their own profile
  id = auth.uid()
  OR
  -- Or if they're an admin updating someone else's profile
  EXISTS (
    SELECT 1
    FROM public.profiles AS admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND id != auth.uid()
  )
);

-- Create policy for profile deletion
CREATE POLICY "Allow profile deletion"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
    AND id != auth.uid()
  )
);