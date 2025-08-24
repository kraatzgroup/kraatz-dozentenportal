-- First, let's check if the admin user exists in auth.users
DO $$
DECLARE
    admin_user_id uuid;
    admin_email text := 'tools@kraatz-group.de';
BEGIN
    -- Check if user exists in auth.users
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = admin_email;
    
    IF admin_user_id IS NULL THEN
        -- User doesn't exist, we need to create it
        RAISE NOTICE 'Admin user does not exist in auth.users. Please create it through Supabase dashboard.';
    ELSE
        -- User exists, make sure profile exists
        INSERT INTO profiles (id, role, full_name, email)
        VALUES (admin_user_id, 'admin', 'Admin User', admin_email)
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            full_name = 'Admin User',
            email = admin_email;
        
        RAISE NOTICE 'Admin profile updated for user: %', admin_user_id;
    END IF;
END $$;