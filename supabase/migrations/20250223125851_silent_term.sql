/*
  # Create Admin Profile

  1. Changes
    - Insert admin profile for tools@kraatz-group.de
*/

INSERT INTO profiles (id, role, full_name)
VALUES (
  'b91979ba-f5f6-44e5-b35a-217691f2f1ac',
  'admin',
  'Admin User'
)
ON CONFLICT (id) DO NOTHING;