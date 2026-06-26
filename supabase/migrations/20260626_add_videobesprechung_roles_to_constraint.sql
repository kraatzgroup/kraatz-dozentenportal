-- Migration: Add videobesprechung roles to additional_roles constraint
-- Created: 2026-06-26
--
-- Changes:
-- 1. Update profiles_additional_roles_check to include videobesprechung roles

-- Drop existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_additional_roles_check;

-- Add updated constraint with videobesprechung roles
ALTER TABLE profiles ADD CONSTRAINT profiles_additional_roles_check
  CHECK (additional_roles <@ ARRAY['admin'::text, 'buchhaltung'::text, 'verwaltung'::text, 'vertrieb'::text, 'dozent'::text, 'teilnehmer'::text, 'videobesprechung'::text, 'videobesprechung_dozent'::text]);

COMMENT ON CONSTRAINT profiles_additional_roles_check ON profiles IS 'Ensures additional_roles only contains valid roles including videobesprechung roles';