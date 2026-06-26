-- Add account_credits field to profiles table for video besprechung credit tracking
ALTER TABLE profiles 
ADD COLUMN account_credits INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN profiles.account_credits IS 'Available credits for video besprechung case studies. Decremented when requesting new case studies.';