-- ============================================
-- Fix: Security Definer View linter errors
-- ============================================
-- Postgres views default to SECURITY DEFINER semantics (run with the
-- view creator's privileges). Supabase's linter flags this because it
-- bypasses the querying user's RLS. Switching to security_invoker
-- makes the views respect the caller's permissions and RLS policies.
--
-- This is a non-breaking change: the view definitions stay the same,
-- only the permission/RLS evaluation context changes to the invoker.
-- Underlying tables already have appropriate RLS policies for
-- authenticated users.
-- ============================================

ALTER VIEW public.teilnehmer_contracts_overview SET (security_invoker = true);
ALTER VIEW public.elite_units_status SET (security_invoker = true);

DO $$
BEGIN
  RAISE NOTICE 'security_invoker=true set on teilnehmer_contracts_overview and elite_units_status';
END $$;
