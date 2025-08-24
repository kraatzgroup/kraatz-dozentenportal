/*
  # Update folder policies

  1. Changes
    - Add policies for folder access
    - Update existing policies to handle user-specific access
*/

-- Update folder policies
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all folders" ON folders;
CREATE POLICY "Admins can view all folders" ON folders
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can create folders" ON folders;
CREATE POLICY "Users can create folders" ON folders
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() AND NOT is_system OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() AND NOT is_system OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );