-- Migration: Add multi-role support and teilnehmer role
-- Created: 2026-03-08
--
-- Changes:
-- 1. Update profiles_role_check constraint to include 'teilnehmer'
-- 2. Add additional_roles text[] column to profiles
-- 3. Update key RLS policies to check additional_roles where needed

-- Step 1: Update the role constraint to include 'teilnehmer'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'buchhaltung'::text, 'verwaltung'::text, 'vertrieb'::text, 'dozent'::text, 'teilnehmer'::text]));

-- Step 2: Add additional_roles column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS additional_roles text[] DEFAULT '{}';

-- Step 3: Add a check constraint to ensure additional_roles only contains valid roles
ALTER TABLE profiles ADD CONSTRAINT profiles_additional_roles_check
  CHECK (additional_roles <@ ARRAY['admin'::text, 'buchhaltung'::text, 'verwaltung'::text, 'vertrieb'::text, 'dozent'::text, 'teilnehmer'::text]);

-- Step 4: Update RLS policies that check for specific non-admin roles
-- to also check additional_roles

-- Helper function to check if a user has a specific role (primary or additional)
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, check_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND (role = check_role OR check_role = ANY(additional_roles))
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_has_role(uuid, text) TO authenticated;

COMMENT ON COLUMN profiles.additional_roles IS 'Additional roles for the user beyond the primary role. Enables multi-role assignments like verwaltung+buchhaltung or dozent+teilnehmer.';
