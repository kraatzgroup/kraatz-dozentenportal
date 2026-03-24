-- Add unique constraint on email to prevent duplicate profiles
-- full_name can be duplicated temporarily during migration
ALTER TABLE profiles ADD CONSTRAINT unique_email UNIQUE (email);
