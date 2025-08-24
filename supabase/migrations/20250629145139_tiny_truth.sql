/*
  # Add email column to profiles table

  1. New Columns
    - `email` (text, unique, not null) - Email address from auth.users

  2. Changes
    - Add email column to profiles table
    - Populate with data from auth.users table
    - Add unique constraint on email
    - Handle any profiles without corresponding auth users

  3. Security
    - Maintains data integrity with proper constraints
*/

-- Add email column to profiles table (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- Update existing profiles with email from auth.users
UPDATE profiles 
SET email = auth_users.email
FROM auth.users auth_users
WHERE profiles.id = auth_users.id
AND profiles.email IS NULL;

-- Handle any profiles that don't have corresponding auth users
-- Set a default email for orphaned profiles (this shouldn't happen in normal operation)
UPDATE profiles 
SET email = 'unknown-' || id || '@example.com'
WHERE email IS NULL;

-- Now make email column not null since all rows have values
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;

-- Add unique constraint on email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_email_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;