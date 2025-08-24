/*
  # Update profiles role constraint

  1. Changes
    - Update the profiles_role_check constraint to include new roles
    - Add 'buchhaltung', 'verwaltung', 'vertrieb' to allowed roles
    - Keep existing 'admin' and 'dozent' roles

  2. Security
    - Maintains data integrity with proper role validation
    - Ensures only valid roles can be assigned to users
*/

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the updated constraint with all valid roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['admin'::text, 'buchhaltung'::text, 'verwaltung'::text, 'vertrieb'::text, 'dozent'::text]));