/*
  # Add email column to profiles table

  1. Changes
    - Add email column to profiles table
    - Add unique constraint to ensure no duplicate emails
    - Add NOT NULL constraint to ensure email is always provided
    - Add email validation using CHECK constraint
*/

-- Add email column with constraints
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
ADD CONSTRAINT profiles_email_unique UNIQUE (email),
ADD CONSTRAINT profiles_email_check CHECK (
  email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Update existing admin user's email
UPDATE profiles
SET email = 'admin@example.com'
WHERE id = '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b'
AND role = 'admin';