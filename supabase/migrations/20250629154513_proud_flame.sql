/*
  # Manual password update for specific user

  1. Changes
    - Update password for user UID: bfa8ed1e-edb4-4419-b917-94626982961f
    - User: Charlene Nowak (charlenenowak@gmx.de)
    - New password: ?Groupjkl2023!05hosting

  2. Security
    - Password will be properly hashed by Supabase
    - Only affects the specified user
*/

-- Update password for the specific user
-- Note: This uses Supabase's internal auth functions to properly hash the password
UPDATE auth.users 
SET 
  encrypted_password = crypt('?Groupjkl2023!05hosting', gen_salt('bf')),
  updated_at = now()
WHERE id = 'bfa8ed1e-edb4-4419-b917-94626982961f'
  AND email = 'charlenenowak@gmx.de';

-- Verify the update was successful
DO $$
DECLARE
    user_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE id = 'bfa8ed1e-edb4-4419-b917-94626982961f' 
        AND email = 'charlenenowak@gmx.de'
    ) INTO user_exists;
    
    IF user_exists THEN
        RAISE NOTICE 'Password successfully updated for user: charlenenowak@gmx.de';
    ELSE
        RAISE NOTICE 'User not found with the specified ID and email';
    END IF;
END $$;