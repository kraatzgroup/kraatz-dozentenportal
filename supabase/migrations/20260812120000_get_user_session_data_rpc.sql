-- Migration: Add server-side session data RPC as single source of truth for authorization
-- Created: 2026-08-12
--
-- Problem: The client fetched `profiles` directly and separately queried `teilnehmer`
-- to determine Elite-Kleingruppe membership. The `teilnehmer` table has NO RLS policy
-- allowing self-read via `profile_id`, so the client-side elite check always returned
-- null for teilnehmer users. This caused the route to render EliteKleingruppeDashboard
-- for ANY user with the `teilnehmer` role — including VB-only participants who are not
-- Elite-Kleingruppe members.
--
-- Solution: A single SECURITY DEFINER function that reads across `profiles` and
-- `teilnehmer` (bypassing RLS for the self-read) and returns the full authorization
-- context. The client calls this on every page load as the single source of truth.

CREATE OR REPLACE FUNCTION public.get_user_session_data()
RETURNS TABLE (
  role text,
  additional_roles text[],
  full_name text,
  first_name text,
  last_name text,
  vb_legal_areas text[],
  vb_springer boolean,
  is_elite_kleingruppe boolean,
  elite_kleingruppe_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.role,
    p.additional_roles,
    p.full_name,
    p.first_name,
    p.last_name,
    p.vb_legal_areas,
    COALESCE(p.vb_springer, false),
    COALESCE(t.is_elite_kleingruppe, false),
    t.elite_kleingruppe_id
  FROM profiles p
  LEFT JOIN teilnehmer t ON t.profile_id = p.id
  WHERE p.id = auth.uid();
$$;

-- Grant execute to authenticated users (they can only read their own data via auth.uid())
GRANT EXECUTE ON FUNCTION public.get_user_session_data() TO authenticated;

COMMENT ON FUNCTION public.get_user_session_data() IS
  'Server-side single source of truth for user authorization context. Returns role, additional_roles, elite-kleingruppe membership, and VB springer flag. Uses auth.uid() so a user can only read their own data.';
