-- Migration: Create notification_logs table for email send tracking
-- Date: 2026-08-24
-- Purpose: Persist a record of every email sent by the *-notify edge
-- functions so the team can verify in the portal (without Mailgun API
-- access) who received which notification and when, and diagnose failed
-- sends. Edge functions write rows using the service role key; admins
-- can read all rows.

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Which edge function sent the email
  edge_function TEXT NOT NULL,

  -- Email envelope
  sender TEXT,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,

  -- Delivery status
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider TEXT NOT NULL DEFAULT 'mailgun',
  provider_message_id TEXT,

  -- Error details (NULL when status = 'sent')
  error_message TEXT,

  -- Structured context about what triggered the email (e.g. klausurId,
  -- caseStudyId, messageId). Stored as jsonb so each edge function can
  -- attach its own relevant fields without schema changes.
  context JSONB,

  -- The payload that was sent to the email provider, minus any secrets.
  -- Useful for reproducing/diagnosing issues.
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at
  ON notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_email
  ON notification_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_notification_logs_edge_function
  ON notification_logs (edge_function);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
  ON notification_logs (status);

-- Row Level Security: only admins can read. Edge functions insert via
-- the service role key which bypasses RLS, so no INSERT policy is needed
-- for authenticated users.
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view notification logs" ON notification_logs;
CREATE POLICY "Admins can view notification logs"
  ON notification_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete notification logs" ON notification_logs;
CREATE POLICY "Admins can delete notification logs"
  ON notification_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE notification_logs IS
'Persistent log of emails sent by *-notify edge functions. Written by edge functions via the service role key; readable by admins.';
