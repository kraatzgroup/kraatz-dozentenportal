/*
  # Fix profiles INSERT RLS policy for bulk dozent import
  
  The current policy only allows admin role to insert profiles for other users.
  This update also allows accounting and verwaltung roles to create dozent profiles.
*/

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = id) OR 
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'accounting', 'verwaltung')
    ))
  );
