-- Fix foreign key constraints on teilnehmer table to allow profile deletion
-- This migration drops and recreates foreign key constraints with ON DELETE CASCADE or SET NULL

-- First, get all foreign key constraints on teilnehmer that reference profiles
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Loop through all foreign key constraints on teilnehmer that reference profiles
    FOR constraint_record IN 
        SELECT 
            tc.constraint_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'teilnehmer' 
            AND tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'profiles'
    LOOP
        -- Drop the existing constraint
        EXECUTE format('ALTER TABLE teilnehmer DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
        
        -- Recreate with ON DELETE SET NULL (safer than CASCADE for most dozent references)
        -- This allows deleting profiles while keeping teilnehmer records
        EXECUTE format(
            'ALTER TABLE teilnehmer ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES profiles(id) ON DELETE SET NULL',
            constraint_record.constraint_name,
            constraint_record.column_name
        );
        
        RAISE NOTICE 'Updated constraint % on column %', constraint_record.constraint_name, constraint_record.column_name;
    END LOOP;
END $$;

-- Add comment explaining the change
COMMENT ON TABLE teilnehmer IS 'Participant table with foreign keys to profiles set to ON DELETE SET NULL to allow profile deletion';
