/*
  # Fix pg_net schema access for Edge Function triggers

  1. Database Configuration
    - Add net schema to search path for supabase_functions_admin role
    - Ensure pg_net functions are accessible to database triggers
    - Fix "schema 'net' does not exist" error

  2. Security
    - Maintain existing RLS policies
    - No changes to user permissions
*/

-- Add the net schema to the search path for the functions admin role
-- This allows database triggers to access pg_net functions
ALTER ROLE supabase_functions_admin SET search_path TO public, net;

-- Also set it for the postgres role to ensure compatibility
ALTER ROLE postgres SET search_path TO public, net;

-- Refresh the current session's search path
SET search_path TO public, net;

-- Verify that pg_net extension is properly configured
DO $$
BEGIN
  -- Check if pg_net extension exists
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net extension is not installed. Please enable it in the Supabase Dashboard.';
  ELSE
    RAISE NOTICE 'pg_net extension is properly installed and configured.';
  END IF;
END $$;