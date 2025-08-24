/*
  # Fix profiles table role column

  1. Changes
    - Ensure the role column exists in the profiles table
    - Set proper constraints and default values
    - Add check constraint for valid role values

  2. Security
    - Maintain existing RLS policies
*/

-- First, check if the role column exists and add it if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'dozent';
  END IF;
END $$;

-- Ensure the role column has the correct constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
  
  -- Add the correct constraint
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role = ANY (ARRAY['admin'::text, 'dozent'::text]));
END $$;

-- Update any existing profiles without a role to have 'dozent' as default
UPDATE profiles SET role = 'dozent' WHERE role IS NULL OR role = '';

-- Ensure the role column is NOT NULL
ALTER TABLE profiles ALTER COLUMN role SET NOT NULL;