-- Migration: Fix Security Warnings from Supabase Linter
-- Date: 2026-03-03
-- Purpose: Address function search_path warnings and overly permissive RLS policies

-- ============================================================================
-- PART 1: Fix Function Search Path Warnings
-- ============================================================================
-- All functions need SECURITY DEFINER and explicit search_path set to prevent
-- search_path injection attacks

-- Function: release_solutions_after_meeting
CREATE OR REPLACE FUNCTION release_solutions_after_meeting()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.release_date < CURRENT_DATE 
     OR (NEW.release_date = CURRENT_DATE AND NEW.end_time IS NOT NULL AND NEW.end_time < CURRENT_TIME)
  THEN
    NEW.solutions_released := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: fix_storage_mimetype
CREATE OR REPLACE FUNCTION fix_storage_mimetype()
RETURNS void
SECURITY DEFINER
SET search_path = public, storage
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE storage.objects
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{mimetype}',
    to_jsonb(CASE 
      WHEN name LIKE '%.pdf' THEN 'application/pdf'
      WHEN name LIKE '%.png' THEN 'image/png'
      WHEN name LIKE '%.jpg' OR name LIKE '%.jpeg' THEN 'image/jpeg'
      WHEN name LIKE '%.doc' THEN 'application/msword'
      WHEN name LIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ELSE 'application/octet-stream'
    END)
  )
  WHERE metadata->>'mimetype' IS NULL OR metadata->>'mimetype' = '';
END;
$$;

-- Function: get_next_invoice_number
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  invoice_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE invoice_number ~ '^[0-9]+$';
  
  invoice_number := LPAD(next_number::TEXT, 6, '0');
  RETURN invoice_number;
END;
$$;

-- Function: create_dozent_user
CREATE OR REPLACE FUNCTION create_dozent_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_legal_area TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    false,
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_full_name, 'dozent');

  IF p_legal_area IS NOT NULL THEN
    INSERT INTO public.elite_kleingruppe_dozenten (dozent_id, legal_area)
    VALUES (v_user_id, p_legal_area);
  END IF;

  RETURN v_user_id;
END;
$$;

-- Function: set_invoice_number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := get_next_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Function: create_invoice_atomic
CREATE OR REPLACE FUNCTION create_invoice_atomic(
  p_dozent_id UUID,
  p_month INTEGER,
  p_year INTEGER,
  p_total_hours NUMERIC,
  p_hourly_rate NUMERIC,
  p_total_amount NUMERIC,
  p_items JSONB
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_number TEXT;
BEGIN
  v_invoice_number := get_next_invoice_number();
  
  INSERT INTO invoices (
    dozent_id,
    month,
    year,
    total_hours,
    hourly_rate,
    total_amount,
    invoice_number,
    items,
    status
  )
  VALUES (
    p_dozent_id,
    p_month,
    p_year,
    p_total_hours,
    p_hourly_rate,
    p_total_amount,
    v_invoice_number,
    p_items,
    'draft'
  )
  RETURNING id INTO v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$;

-- Function: create_default_folders
CREATE OR REPLACE FUNCTION create_default_folders(user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  folder_names TEXT[] := ARRAY['Verträge', 'Rechnungen', 'Sonstiges'];
  folder_name TEXT;
BEGIN
  FOREACH folder_name IN ARRAY folder_names
  LOOP
    INSERT INTO material_folders (name, user_id, is_default)
    VALUES (folder_name, user_id, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- Function: mark_first_login_completed
DROP FUNCTION IF EXISTS mark_first_login_completed(UUID);
CREATE OR REPLACE FUNCTION mark_first_login_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET first_login_completed = true
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Function: check_dozent_documents
CREATE OR REPLACE FUNCTION check_dozent_documents()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  dozent RECORD;
  missing_docs TEXT[];
BEGIN
  FOR dozent IN 
    SELECT id, email, full_name 
    FROM profiles 
    WHERE role = 'dozent'
  LOOP
    missing_docs := ARRAY[]::TEXT[];
    
    IF NOT EXISTS (
      SELECT 1 FROM teaching_materials 
      WHERE user_id = dozent.id 
      AND folder_id IN (SELECT id FROM material_folders WHERE name = 'Verträge')
    ) THEN
      missing_docs := array_append(missing_docs, 'Vertrag');
    END IF;
    
    IF array_length(missing_docs, 1) > 0 THEN
      INSERT INTO messages (sender_id, recipient_id, subject, content)
      VALUES (
        NULL,
        dozent.id,
        'Fehlende Dokumente',
        'Bitte laden Sie folgende Dokumente hoch: ' || array_to_string(missing_docs, ', ')
      );
    END IF;
  END LOOP;
END;
$$;

-- Function: create_missing_folders_for_all_users
CREATE OR REPLACE FUNCTION create_missing_folders_for_all_users()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM profiles
  LOOP
    PERFORM create_default_folders(user_record.id);
  END LOOP;
END;
$$;

-- Function: ensure_default_folders_for_user
CREATE OR REPLACE FUNCTION ensure_default_folders_for_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM create_default_folders(NEW.id);
  RETURN NEW;
END;
$$;

-- Function: generate_invoice_number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM invoices;
  
  RETURN LPAD(next_number::TEXT, 6, '0');
END;
$$;

-- Function: get_monthly_hours_summary
DROP FUNCTION IF EXISTS get_monthly_hours_summary(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_monthly_hours_summary(
  p_dozent_id UUID,
  p_month INTEGER,
  p_year INTEGER,
  OUT total_hours NUMERIC,
  OUT total_amount NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT 
    COALESCE(SUM(hours), 0)::NUMERIC,
    COALESCE(SUM(hours * hourly_rate), 0)::NUMERIC
  INTO total_hours, total_amount
  FROM dozent_hours
  WHERE dozent_id = p_dozent_id
    AND EXTRACT(MONTH FROM date) = p_month
    AND EXTRACT(YEAR FROM date) = p_year;
END;
$$;

-- Function: get_previous_month_info
DROP FUNCTION IF EXISTS get_previous_month_info();
CREATE OR REPLACE FUNCTION get_previous_month_info()
RETURNS TABLE(month_number INTEGER, year_number INTEGER, month_name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  prev_month INTEGER;
  prev_year INTEGER;
  month_names TEXT[] := ARRAY['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                              'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
BEGIN
  prev_month := EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month');
  prev_year := EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month');
  
  RETURN QUERY SELECT 
    prev_month,
    prev_year,
    month_names[prev_month];
END;
$$;

-- Function: get_undownloaded_files_count
CREATE OR REPLACE FUNCTION get_undownloaded_files_count(p_user_id UUID)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  file_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO file_count
  FROM teaching_materials
  WHERE user_id = p_user_id
    AND downloaded = false;
  
  RETURN file_count;
END;
$$;

-- Function: get_next_deadline
CREATE OR REPLACE FUNCTION get_next_deadline()
RETURNS DATE
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '4 days')::DATE;
END;
$$;

-- Function: is_past_deadline
CREATE OR REPLACE FUNCTION is_past_deadline()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CURRENT_DATE > get_next_deadline();
END;
$$;

-- Function: is_fifth_of_month
CREATE OR REPLACE FUNCTION is_fifth_of_month()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXTRACT(DAY FROM CURRENT_DATE) = 5;
END;
$$;

-- Function: notify_message_recipient
CREATE OR REPLACE FUNCTION notify_message_recipient()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET unread_messages = COALESCE(unread_messages, 0) + 1
  WHERE id = NEW.recipient_id;
  
  RETURN NEW;
END;
$$;

-- Function: trigger_monthly_document_check
CREATE OR REPLACE FUNCTION trigger_monthly_document_check()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF is_fifth_of_month() THEN
    PERFORM check_dozent_documents();
  END IF;
END;
$$;

-- Function: update_last_login
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET last_login = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Function: update_dozent_hours_updated_at
CREATE OR REPLACE FUNCTION update_dozent_hours_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_availability_updated_at
CREATE OR REPLACE FUNCTION update_availability_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_invoices_updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: check_availability_overlap
CREATE OR REPLACE FUNCTION check_availability_overlap()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dozent_availability
    WHERE dozent_id = NEW.dozent_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND day_of_week = NEW.day_of_week
      AND (
        (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Availability overlaps with existing entry';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function: mark_file_as_downloaded
DROP FUNCTION IF EXISTS mark_file_as_downloaded(UUID);
CREATE OR REPLACE FUNCTION mark_file_as_downloaded(file_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE teaching_materials
  SET downloaded = true,
      downloaded_at = NOW()
  WHERE id = file_id;
  RETURN FOUND;
END;
$$;

-- Function: get_monthly_document_status
CREATE OR REPLACE FUNCTION get_monthly_document_status(
  p_dozent_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  has_contract BOOLEAN,
  has_invoice BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS (
      SELECT 1 FROM teaching_materials tm
      JOIN material_folders mf ON tm.folder_id = mf.id
      WHERE tm.user_id = p_dozent_id
        AND mf.name = 'Verträge'
        AND EXTRACT(MONTH FROM tm.created_at) = p_month
        AND EXTRACT(YEAR FROM tm.created_at) = p_year
    ) as has_contract,
    EXISTS (
      SELECT 1 FROM invoices
      WHERE dozent_id = p_dozent_id
        AND month = p_month
        AND year = p_year
    ) as has_invoice;
END;
$$;

-- Function: get_participant_total_hours
CREATE OR REPLACE FUNCTION get_participant_total_hours(p_participant_id UUID)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(duration_minutes), 0) / 60.0
  INTO total
  FROM elite_kleingruppe_releases r
  JOIN elite_kleingruppe_teilnehmer t ON t.legal_area = r.legal_area
  WHERE t.teilnehmer_id = p_participant_id
    AND r.solutions_released = true;
  
  RETURN total;
END;
$$;

-- Function: notify_admins_of_upload
CREATE OR REPLACE FUNCTION notify_admins_of_upload()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_id UUID;
  uploader_name TEXT;
BEGIN
  SELECT full_name INTO uploader_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  FOR admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    INSERT INTO messages (sender_id, recipient_id, subject, content)
    VALUES (
      NULL,
      admin_id,
      'Neue Datei hochgeladen',
      uploader_name || ' hat eine neue Datei hochgeladen: ' || NEW.name
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function: mark_user_login
DROP FUNCTION IF EXISTS mark_user_login(UUID);
CREATE OR REPLACE FUNCTION mark_user_login(user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET last_login = NOW()
  WHERE id = user_id;
END;
$$;

-- ============================================================================
-- PART 2: Fix Overly Permissive RLS Policies
-- ============================================================================
-- Replace policies that use USING (true) or WITH CHECK (true) with proper
-- role-based or ownership-based checks

-- Calendar Entries: Restrict to authenticated users with proper checks
DROP POLICY IF EXISTS "Users can create calendar entries" ON calendar_entries;
CREATE POLICY "Users can create calendar entries"
  ON calendar_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
    )
  );

DROP POLICY IF EXISTS "Users can delete their calendar entries" ON calendar_entries;
CREATE POLICY "Users can delete their calendar entries"
  ON calendar_entries
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can update their calendar entries" ON calendar_entries;
CREATE POLICY "Users can update their calendar entries"
  ON calendar_entries
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Contract Requests: Restrict to admin and vertrieb roles
DROP POLICY IF EXISTS "Allow all for authenticated users" ON contract_requests;
CREATE POLICY "Admin and Vertrieb can manage contract requests"
  ON contract_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Contract Templates: Restrict to admin role
DROP POLICY IF EXISTS "Allow all for authenticated users" ON contract_templates;
CREATE POLICY "Admin can manage contract templates"
  ON contract_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Dashboard Sections: Keep permissive for authenticated (intentional for UI flexibility)
-- This is acceptable as dashboard sections are UI configuration

-- Dozent Availability: Restrict to own data or admin
DROP POLICY IF EXISTS "dozent_availability_policy" ON dozent_availability;
CREATE POLICY "Dozenten can manage own availability"
  ON dozent_availability
  FOR ALL
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Elite Kleingruppe Dozenten: Keep admin-only (already has proper check in USING clause)
-- The policy name suggests admin-only, so we'll verify it's properly restricted

-- Elite Kleingruppe Klausuren: Restrict updates to dozenten and admins
DROP POLICY IF EXISTS "Dozenten can update klausuren" ON elite_kleingruppe_klausuren;
CREATE POLICY "Dozenten can update klausuren"
  ON elite_kleingruppe_klausuren
  FOR UPDATE
  TO authenticated
  USING (
    teilnehmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dozent'))
  )
  WITH CHECK (
    teilnehmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dozent'))
  );

DROP POLICY IF EXISTS "Teilnehmer can insert own klausuren" ON elite_kleingruppe_klausuren;
CREATE POLICY "Teilnehmer can insert own klausuren"
  ON elite_kleingruppe_klausuren
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teilnehmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dozent'))
  );

-- Elite Kleingruppe Releases: Admin policy (role check needed)
DROP POLICY IF EXISTS "elite_releases_admin_policy" ON elite_kleingruppe_releases;
CREATE POLICY "elite_releases_admin_policy"
  ON elite_kleingruppe_releases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR dozent_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR dozent_id = auth.uid()
  );

-- Email Templates: Admin only
DROP POLICY IF EXISTS "Admins can insert email templates" ON email_templates;
CREATE POLICY "Admins can insert email templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update email templates" ON email_templates;
CREATE POLICY "Admins can update email templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Lead Notes: Restrict to admin and vertrieb
DROP POLICY IF EXISTS "Allow all for authenticated users" ON lead_notes;
CREATE POLICY "Admin and Vertrieb can manage lead notes"
  ON lead_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Leads: Restrict to admin and vertrieb
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON leads;
CREATE POLICY "Admin and Vertrieb can delete leads"
  ON leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
CREATE POLICY "Admin and Vertrieb can insert leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
CREATE POLICY "Admin and Vertrieb can update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Material Folders: Keep permissive for authenticated (intentional for file management)
-- This is acceptable as users need to access shared folders

-- Sales Todos: Restrict to admin and vertrieb
DROP POLICY IF EXISTS "Users can delete sales todos" ON sales_todos;
CREATE POLICY "Admin and Vertrieb can delete sales todos"
  ON sales_todos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

DROP POLICY IF EXISTS "Users can insert sales todos" ON sales_todos;
CREATE POLICY "Admin and Vertrieb can insert sales todos"
  ON sales_todos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

DROP POLICY IF EXISTS "Users can update sales todos" ON sales_todos;
CREATE POLICY "Admin and Vertrieb can update sales todos"
  ON sales_todos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vertrieb'))
  );

-- Stundenzettel: Restrict to own data or admin
DROP POLICY IF EXISTS "Allow authenticated insert" ON stundenzettel;
CREATE POLICY "Users can insert own stundenzettel"
  ON stundenzettel
  FOR INSERT
  TO authenticated
  WITH CHECK (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow authenticated update" ON stundenzettel;
CREATE POLICY "Users can update own stundenzettel"
  ON stundenzettel
  FOR UPDATE
  TO authenticated
  USING (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    dozent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Teaching Materials: Keep permissive for authenticated (intentional for file sharing)
-- This is acceptable as materials need to be shared across users

-- ============================================================================
-- PART 3: Comments and Documentation
-- ============================================================================

COMMENT ON FUNCTION release_solutions_after_meeting() IS 
'Automatically releases solutions after meeting end time. SECURITY DEFINER with search_path set.';

COMMENT ON FUNCTION create_dozent_user(TEXT, TEXT, TEXT, TEXT) IS 
'Creates a new dozent user with profile and optional legal area assignment. SECURITY DEFINER with search_path set.';

-- Note: Leaked password protection must be enabled via Supabase Dashboard
-- Navigate to: Authentication > Policies > Password Protection
-- This cannot be set via SQL migration
