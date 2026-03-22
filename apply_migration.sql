-- Migration: Add cancellation and rescheduling functionality to elite_kleingruppe_releases
-- Date: 2026-03-22
-- Description: Adds columns to track canceled and rescheduled appointments
-- 
-- ANLEITUNG: Kopieren Sie dieses SQL-Skript und führen Sie es im Supabase SQL Editor aus:
-- https://supabase.com/dashboard/project/gkkveloqajxghhflkfru/sql/new

-- Add cancellation columns
ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS is_canceled BOOLEAN DEFAULT false;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS canceled_reason TEXT;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES profiles(id);

-- Add rescheduling columns
ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN DEFAULT false;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS rescheduled_to_date DATE;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS rescheduled_to_start_time TIME;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS rescheduled_to_end_time TIME;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS rescheduled_reason TEXT;

ALTER TABLE elite_kleingruppe_releases 
ADD COLUMN IF NOT EXISTS rescheduled_by UUID REFERENCES profiles(id);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_elite_releases_is_canceled ON elite_kleingruppe_releases(is_canceled);
CREATE INDEX IF NOT EXISTS idx_elite_releases_is_rescheduled ON elite_kleingruppe_releases(is_rescheduled);
CREATE INDEX IF NOT EXISTS idx_elite_releases_canceled_by ON elite_kleingruppe_releases(canceled_by);
CREATE INDEX IF NOT EXISTS idx_elite_releases_rescheduled_by ON elite_kleingruppe_releases(rescheduled_by);

-- Add comments for documentation
COMMENT ON COLUMN elite_kleingruppe_releases.is_canceled IS 'Indicates if the appointment has been canceled';
COMMENT ON COLUMN elite_kleingruppe_releases.canceled_at IS 'Timestamp when the appointment was canceled';
COMMENT ON COLUMN elite_kleingruppe_releases.canceled_reason IS 'Reason for cancellation';
COMMENT ON COLUMN elite_kleingruppe_releases.canceled_by IS 'User ID who canceled the appointment';

COMMENT ON COLUMN elite_kleingruppe_releases.is_rescheduled IS 'Indicates if the appointment has been rescheduled';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_at IS 'Timestamp when the appointment was rescheduled';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_to_date IS 'New date for the rescheduled appointment';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_to_start_time IS 'New start time for the rescheduled appointment';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_to_end_time IS 'New end time for the rescheduled appointment';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_reason IS 'Reason for rescheduling';
COMMENT ON COLUMN elite_kleingruppe_releases.rescheduled_by IS 'User ID who rescheduled the appointment';

-- Verify the migration was successful
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'elite_kleingruppe_releases' 
    AND column_name IN (
        'is_canceled', 'canceled_at', 'canceled_reason', 'canceled_by',
        'is_rescheduled', 'rescheduled_at', 'rescheduled_to_date', 
        'rescheduled_to_start_time', 'rescheduled_to_end_time', 
        'rescheduled_reason', 'rescheduled_by'
    )
ORDER BY column_name;
