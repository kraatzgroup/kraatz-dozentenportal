/*
  # Fix duplicate admin profiles

  1. Changes
    - Remove duplicate profiles with same email
    - Keep only the profile that matches the auth user ID
    - Clean up placeholder emails
    - Ensure proper linking between auth.users and profiles

  2. Security
    - Maintains data integrity
    - Preserves correct admin profile
*/

-- Step 1: First, let's identify and remove duplicate profiles with the same email
-- Keep only the profile that has a matching auth.users record
DELETE FROM profiles 
WHERE email = 'tools@kraatz-group.de' 
AND NOT EXISTS (
  SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id AND auth.users.email = 'tools@kraatz-group.de'
);

-- Step 2: Remove any profiles with placeholder emails that have the hardcoded admin ID
-- This removes the duplicate admin profile with unknown email
DELETE FROM profiles 
WHERE id = 'b91979ba-f5f6-44e5-b35a-217691f2f1ac' 
AND email LIKE 'unknown-%@example.com';

-- Step 3: Now check if we have the correct admin profile, if not create it
-- First, get the actual auth user ID for tools@kraatz-group.de
DO $$
DECLARE
    admin_auth_id uuid;
BEGIN
    -- Get the actual auth user ID
    SELECT id INTO admin_auth_id 
    FROM auth.users 
    WHERE email = 'tools@kraatz-group.de' 
    LIMIT 1;
    
    -- If we found an auth user, ensure the profile exists and is correct
    IF admin_auth_id IS NOT NULL THEN
        -- Update existing profile or insert new one
        INSERT INTO profiles (id, role, full_name, email)
        VALUES (admin_auth_id, 'admin', 'Admin User', 'tools@kraatz-group.de')
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            full_name = EXCLUDED.full_name;
    END IF;
END $$;

-- Step 4: Clean up any remaining duplicate profiles
-- Remove profiles with placeholder emails if there's a real profile with the same ID
DELETE FROM profiles p1
WHERE p1.email LIKE 'unknown-%@example.com'
AND EXISTS (
  SELECT 1 FROM profiles p2 
  WHERE p2.id = p1.id 
  AND p2.email NOT LIKE 'unknown-%@example.com'
);

-- Step 5: For remaining profiles with placeholder emails, try to link them to auth.users
-- But only if it won't create a duplicate email
UPDATE profiles 
SET email = auth_users.email
FROM auth.users auth_users
WHERE profiles.id = auth_users.id
AND profiles.email LIKE 'unknown-%@example.com'
AND NOT EXISTS (
  SELECT 1 FROM profiles p2 
  WHERE p2.email = auth_users.email 
  AND p2.id != profiles.id
);

-- Step 6: Remove any orphaned profiles that couldn't be linked
-- These are profiles that don't have corresponding auth users
DELETE FROM profiles 
WHERE email LIKE 'unknown-%@example.com'
AND NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = profiles.id
);

-- Step 7: Remove any remaining email duplicates by keeping only the first one
-- This is a safety net in case there are still duplicates
DELETE FROM profiles p1
WHERE p1.ctid NOT IN (
  SELECT MIN(p2.ctid)
  FROM profiles p2
  WHERE p2.email = p1.email
);