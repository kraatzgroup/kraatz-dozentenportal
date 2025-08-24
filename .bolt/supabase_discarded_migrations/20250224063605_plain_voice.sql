/*
  # Add Profile Picture URL Column

  1. Changes
    - Add profile_picture_url column to profiles table
    - Update existing policies to allow profile picture updates
*/

-- Add profile_picture_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN profile_picture_url text;
  END IF;
END $$;

-- Update profile update policy to explicitly allow profile picture updates
DROP POLICY IF EXISTS "Users can update their own profile picture" ON profiles;
CREATE POLICY "Users can update their own profile picture"
ON profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);