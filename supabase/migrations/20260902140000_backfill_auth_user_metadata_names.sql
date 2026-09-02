-- Backfill auth.users.raw_user_meta_data mit first_name und last_name
-- extrahiert aus full_name, wo first_name noch nicht vorhanden ist
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data
  || jsonb_build_object(
    'first_name', split_part(raw_user_meta_data->>'full_name', ' ', 1),
    'last_name', CASE
      WHEN position(' ' in raw_user_meta_data->>'full_name') > 0
      THEN substring(raw_user_meta_data->>'full_name' from position(' ' in raw_user_meta_data->>'full_name') + 1)
      ELSE NULL
    END
  )
WHERE raw_user_meta_data->>'first_name' IS NULL
  AND raw_user_meta_data->>'full_name' IS NOT NULL
  AND raw_user_meta_data->>'full_name' != '';
