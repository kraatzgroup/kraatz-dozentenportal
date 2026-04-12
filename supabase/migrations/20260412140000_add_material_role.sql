-- Migration: Add 'material' role to profiles table
-- Description: Add a new role 'material' for users who should only have access to the unterrichtsmaterialien tab

-- Step 1: Update the role constraint to include 'material'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'buchhaltung'::text, 'verwaltung'::text, 'vertrieb'::text, 'dozent'::text, 'teilnehmer'::text, 'material'::text]));

-- Step 2: Update the additional_roles check constraint to include 'material'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_additional_roles_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_additional_roles_check
  CHECK (additional_roles <@ ARRAY['admin'::text, 'buchhaltung'::text, 'verwaltung'::text, 'vertrieb'::text, 'dozent'::text, 'teilnehmer'::text, 'material'::text]);
