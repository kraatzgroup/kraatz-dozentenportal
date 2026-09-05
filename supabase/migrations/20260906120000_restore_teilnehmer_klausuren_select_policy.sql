-- Migration: Restore Teilnehmer SELECT policy for elite_kleingruppe_klausuren
-- Created: 2026-09-06
-- Purpose: Fix regression introduced by 20260904b_update_rls_policies_for_group_separation.sql
--
-- The previous migration dropped the combined SELECT policy
-- "Dozenten can view assigned klausuren" (from 20260311) which contained
-- three OR-branches: admins, dozenten, AND teilnehmer (own klausuren).
-- It was replaced by two separate policies covering only admins and dozenten,
-- so Teilnehmer lost the ability to read their own klausuren. As a result
-- participants could no longer see their submitted Klausuren or the
-- Notenspiegel / Punkteverlauf in EliteKleingruppeDashboard.
--
-- This migration re-adds the missing Teilnehmer SELECT policy.

CREATE POLICY "Teilnehmer can view own klausuren"
  ON elite_kleingruppe_klausuren
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teilnehmer
      WHERE teilnehmer.id = elite_kleingruppe_klausuren.teilnehmer_id
        AND teilnehmer.profile_id = auth.uid()
    )
  );

COMMENT ON POLICY "Teilnehmer can view own klausuren" ON elite_kleingruppe_klausuren
  IS 'Teilnehmer can view their own klausuren (regression fix for 20260904b group separation migration)';
