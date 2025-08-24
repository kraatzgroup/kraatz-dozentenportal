/*
  # Enhance admin permissions for user management

  1. Changes
    - Grant explicit admin permissions on auth.users
    - Create additional security policies for auth schema
    - Ensure proper admin access for user management

  2. Security
    - Maintain strict admin-only access
    - Prevent recursion in permission checks
    - Enable proper user deletion
*/

-- Create a more robust admin check function with additional logging
CREATE OR REPLACE FUNCTION public.is_admin_v3()
RETURNS boolean AS $$
DECLARE
  _role text;
  _user_id uuid;
BEGIN
  -- Get the current user ID
  _user_id := auth.uid();
  
  -- Get the role directly
  SELECT role INTO _role
  FROM public.profiles
  WHERE id = _user_id;

  -- Return true only for admin role
  RETURN COALESCE(_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing auth.users policies
DROP POLICY IF EXISTS "Admins can manage users" ON auth.users;

-- Create explicit policies for auth.users
CREATE POLICY "Admins can delete users"
ON auth.users
FOR DELETE
TO authenticated
USING (
  (SELECT public.is_admin_v3()) AND
  id != auth.uid()
);

CREATE POLICY "Admins can view users"
ON auth.users
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_admin_v3())
);

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT ALL ON auth.users TO authenticated;

-- Ensure RLS is enabled but don't recreate if exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'auth'
    AND tablename = 'users'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;