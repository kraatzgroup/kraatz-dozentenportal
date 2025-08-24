-- Check current database state
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'folders', 'files', 'messages')
ORDER BY table_name, ordinal_position;

-- Check if admin user exists
SELECT id, email, role, full_name, created_at 
FROM profiles 
WHERE role = 'admin';

-- Check auth.users table for existing users
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at;