-- Migration: Update RLS policies to be group-specific for Elite-Kleingruppe
-- Created: 2026-09-04
-- Purpose: Ensure Dozenten and Teilnehmer only see data from their own group.
--          Admins can see all groups.

-- =============================================================================
-- Helper: Dozenten can see groups they are assigned to via elite_kleingruppe_dozenten
-- =============================================================================
-- This subquery is reused across multiple policies:
--   elite_kleingruppe_id IN (
--     SELECT elite_kleingruppe_id FROM elite_kleingruppe_dozenten
--     WHERE dozent_id = auth.uid() AND elite_kleingruppe_id IS NOT NULL
--   )

-- =============================================================================
-- 1. elite_kleingruppe_releases
-- =============================================================================
-- Replace the "Alle Nutzer" policy with group-specific access

DROP POLICY IF EXISTS "Alle Nutzer können Elite-Kleingruppe Einheiten sehen" ON elite_kleingruppe_releases;
DROP POLICY IF EXISTS "Teilnehmer can view releases for their group" ON elite_kleingruppe_releases;

-- Teilnehmer: only see releases for their own group
CREATE POLICY "Teilnehmer can view releases for their group"
  ON elite_kleingruppe_releases
  FOR SELECT
  TO authenticated
  USING (
    elite_kleingruppe_id IN (
      SELECT t.elite_kleingruppe_id
      FROM teilnehmer t
      WHERE t.profile_id = auth.uid()
        AND t.is_elite_kleingruppe = true
    )
  );

-- Dozenten: only see releases for groups they are assigned to
CREATE POLICY "Dozenten can view releases for assigned groups"
  ON elite_kleingruppe_releases
  FOR SELECT
  TO authenticated
  USING (
    elite_kleingruppe_id IN (
      SELECT d.elite_kleingruppe_id
      FROM elite_kleingruppe_dozenten d
      WHERE d.dozent_id = auth.uid()
        AND d.elite_kleingruppe_id IS NOT NULL
    )
  );

-- =============================================================================
-- 2. elite_course_times
-- =============================================================================
-- Replace "Everyone can read" with group-specific access

DROP POLICY IF EXISTS "Everyone can read active course times" ON elite_course_times;

-- Teilnehmer: only see course times for their own group
CREATE POLICY "Teilnehmer can view course times for their group"
  ON elite_course_times
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND elite_kleingruppe_id IN (
      SELECT t.elite_kleingruppe_id
      FROM teilnehmer t
      WHERE t.profile_id = auth.uid()
        AND t.is_elite_kleingruppe = true
    )
  );

-- Dozenten: only see course times for groups they are assigned to
CREATE POLICY "Dozenten can view course times for assigned groups"
  ON elite_course_times
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND elite_kleingruppe_id IN (
      SELECT d.elite_kleingruppe_id
      FROM elite_kleingruppe_dozenten d
      WHERE d.dozent_id = auth.uid()
        AND d.elite_kleingruppe_id IS NOT NULL
    )
  );

-- =============================================================================
-- 3. elite_kleingruppe_settings
-- =============================================================================
-- Replace "Teilnehmer can read" with group-specific access (zoom_links only)

DROP POLICY IF EXISTS "Teilnehmer can read elite_kleingruppe_settings" ON elite_kleingruppe_settings;

-- Teilnehmer: only see settings (zoom_links) for their own group
CREATE POLICY "Teilnehmer can read settings for their group"
  ON elite_kleingruppe_settings
  FOR SELECT
  TO authenticated
  USING (
    -- Global settings (elite_kleingruppe_id IS NULL) are visible to all
    elite_kleingruppe_id IS NULL
    OR elite_kleingruppe_id IN (
      SELECT t.elite_kleingruppe_id
      FROM teilnehmer t
      WHERE t.profile_id = auth.uid()
        AND t.is_elite_kleingruppe = true
    )
  );

-- Dozenten: only see settings (zoom_links) for groups they are assigned to
CREATE POLICY "Dozenten can read settings for assigned groups"
  ON elite_kleingruppe_settings
  FOR SELECT
  TO authenticated
  USING (
    -- Global settings (elite_kleingruppe_id IS NULL) are visible to all
    elite_kleingruppe_id IS NULL
    OR elite_kleingruppe_id IN (
      SELECT d.elite_kleingruppe_id
      FROM elite_kleingruppe_dozenten d
      WHERE d.dozent_id = auth.uid()
        AND d.elite_kleingruppe_id IS NOT NULL
    )
  );

-- =============================================================================
-- 4. elite_kleingruppe_klausuren
-- =============================================================================
-- Replace "Dozenten can view all klausuren" with group-specific access

DROP POLICY IF EXISTS "Dozenten can view all klausuren" ON elite_kleingruppe_klausuren;
DROP POLICY IF EXISTS "Dozenten can view assigned klausuren" ON elite_kleingruppe_klausuren;

-- Admins: can view all klausuren
CREATE POLICY "Admins can view all klausuren"
  ON elite_kleingruppe_klausuren
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Dozenten: only see klausuren from participants in groups they are assigned to
-- AND only for legal areas they cover in that group
CREATE POLICY "Dozenten can view klausuren for assigned groups"
  ON elite_kleingruppe_klausuren
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM elite_kleingruppe_dozenten d
      JOIN teilnehmer t ON t.elite_kleingruppe_id = d.elite_kleingruppe_id
      WHERE d.dozent_id = auth.uid()
        AND d.elite_kleingruppe_id IS NOT NULL
        AND t.id = elite_kleingruppe_klausuren.teilnehmer_id
        AND d.legal_area = elite_kleingruppe_klausuren.legal_area
    )
  );

-- =============================================================================
-- 5. elite_kleingruppe_dozenten
-- =============================================================================
-- Replace "Anyone can view" with group-specific access

DROP POLICY IF EXISTS "Anyone can view dozenten assignments" ON elite_kleingruppe_dozenten;

-- Dozenten: only see their own assignments
CREATE POLICY "Dozenten can view their own dozenten assignments"
  ON elite_kleingruppe_dozenten
  FOR SELECT
  TO authenticated
  USING (dozent_id = auth.uid());

-- Teilnehmer: can see assignments for their own group (to know who their dozent is)
CREATE POLICY "Teilnehmer can view dozenten assignments for their group"
  ON elite_kleingruppe_dozenten
  FOR SELECT
  TO authenticated
  USING (
    elite_kleingruppe_id IN (
      SELECT t.elite_kleingruppe_id
      FROM teilnehmer t
      WHERE t.profile_id = auth.uid()
        AND t.is_elite_kleingruppe = true
    )
  );

-- =============================================================================
-- 6. elite_kleingruppe_dozent_assignments (detailed assignments table)
-- =============================================================================
-- Check if there are existing policies and update them

DROP POLICY IF EXISTS "Dozenten can view their own assignments" ON elite_kleingruppe_dozent_assignments;

-- Dozenten: only see their own detailed assignments
CREATE POLICY "Dozenten can view their own detailed assignments"
  ON elite_kleingruppe_dozent_assignments
  FOR SELECT
  TO authenticated
  USING (dozent_id = auth.uid());

-- =============================================================================
-- 7. elite_kleingruppen (the groups table itself)
-- =============================================================================
-- Already has group-specific policies from the original migration, but let's
-- verify Dozenten can see groups they are assigned to (not just any group)

DROP POLICY IF EXISTS "Dozenten can view elite_kleingruppen" ON elite_kleingruppen;

CREATE POLICY "Dozenten can view their assigned elite_kleingruppen"
  ON elite_kleingruppen
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT d.elite_kleingruppe_id
      FROM elite_kleingruppe_dozenten d
      WHERE d.dozent_id = auth.uid()
        AND d.elite_kleingruppe_id IS NOT NULL
    )
  );

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON POLICY "Teilnehmer can view releases for their group" ON elite_kleingruppe_releases
  IS 'Teilnehmer can only see releases for their own elite group';
COMMENT ON POLICY "Dozenten can view releases for assigned groups" ON elite_kleingruppe_releases
  IS 'Dozenten can only see releases for groups they are assigned to';
COMMENT ON POLICY "Teilnehmer can view course times for their group" ON elite_course_times
  IS 'Teilnehmer can only see course times for their own elite group';
COMMENT ON POLICY "Dozenten can view course times for assigned groups" ON elite_course_times
  IS 'Dozenten can only see course times for groups they are assigned to';
COMMENT ON POLICY "Teilnehmer can read settings for their group" ON elite_kleingruppe_settings
  IS 'Teilnehmer can only see settings (zoom_links) for their own group; global settings visible to all';
COMMENT ON POLICY "Dozenten can read settings for assigned groups" ON elite_kleingruppe_settings
  IS 'Dozenten can only see settings (zoom_links) for groups they are assigned to; global settings visible to all';
COMMENT ON POLICY "Dozenten can view klausuren for assigned groups" ON elite_kleingruppe_klausuren
  IS 'Dozenten can only see klausuren from participants in groups they are assigned to, for their legal areas';
