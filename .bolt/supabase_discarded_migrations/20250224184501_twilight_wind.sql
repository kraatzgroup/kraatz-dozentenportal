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