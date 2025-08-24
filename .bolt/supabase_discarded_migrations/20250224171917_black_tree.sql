/*
  # Set up admin user with specific UID
  
  This migration:
  1. Updates the admin user with the correct UID
  2. Creates default folders for the admin user
*/

-- Update admin user with correct UID
INSERT INTO profiles (id, role, full_name)
VALUES (
  '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b',
  'admin',
  'Admin User'
) ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    full_name = 'Admin User';

-- Create default folders for admin if they don't exist
INSERT INTO folders (name, user_id, is_system)
SELECT 'Rechnungen', '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b', true
WHERE NOT EXISTS (
  SELECT 1 FROM folders 
  WHERE user_id = '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b' 
  AND name = 'Rechnungen'
);

INSERT INTO folders (name, user_id, is_system)
SELECT 'Tätigkeitsbericht', '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b', true
WHERE NOT EXISTS (
  SELECT 1 FROM folders 
  WHERE user_id = '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b' 
  AND name = 'Tätigkeitsbericht'
);

INSERT INTO folders (name, user_id, is_system)
SELECT 'Aktive Teilnehmer', '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b', true
WHERE NOT EXISTS (
  SELECT 1 FROM folders 
  WHERE user_id = '264d205e-15ea-4a2c-aa7c-f23fc3a6ed0b' 
  AND name = 'Aktive Teilnehmer'
);