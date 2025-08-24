-- Drop existing policies
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Create new profile policies with proper admin checks
CREATE POLICY "profiles_read"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to create their own initial profile
  auth.uid() = id
  OR
  -- Or if they're an admin creating other profiles
  (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

CREATE POLICY "profiles_update"
ON profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Or if they're an admin updating someone else's profile
  (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    AND id != auth.uid()
  )
);

CREATE POLICY "profiles_delete"
ON profiles
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles (except their own)
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  AND id != auth.uid()
  AND NOT EXISTS (
    SELECT 1
    FROM profiles p2
    WHERE p2.id = profiles.id
    AND p2.role = 'admin'
  )
);

-- Update the is_admin function to be more secure
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON profiles(id, role);