-- Backfill profiles.first_name und profiles.last_name aus auth.users.raw_user_meta_data.full_name
-- für alle Profile, bei denen first_name NULL ist
UPDATE profiles p
SET
  first_name = split_part(u.raw_user_meta_data->>'full_name', ' ', 1),
  last_name = COALESCE(
    NULLIF(
      substring(
        u.raw_user_meta_data->>'full_name'
        FROM position(' ' in u.raw_user_meta_data->>'full_name') + 1
      ),
      ''
    ),
    p.last_name
  )
FROM auth.users u
WHERE p.id = u.id
  AND p.first_name IS NULL
  AND u.raw_user_meta_data->>'full_name' IS NOT NULL
  AND u.raw_user_meta_data->>'full_name' != '';
