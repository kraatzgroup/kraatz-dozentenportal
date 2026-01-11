-- Add new status values for trial lessons workflow
-- Stages: requested -> dozent_assigned -> confirmed -> scheduled -> completed/no_show/cancelled/converted

-- First, we need to update the status column to allow new values
-- The existing values are: scheduled, completed, no_show, cancelled, converted
-- New values to add: requested, dozent_assigned, confirmed

-- Update the check constraint to allow new status values
ALTER TABLE trial_lessons DROP CONSTRAINT IF EXISTS trial_lessons_status_check;

ALTER TABLE trial_lessons ADD CONSTRAINT trial_lessons_status_check 
CHECK (status IN ('requested', 'dozent_assigned', 'confirmed', 'scheduled', 'completed', 'no_show', 'cancelled', 'converted'));

-- Add column for dozent confirmation status
ALTER TABLE trial_lessons ADD COLUMN IF NOT EXISTS dozent_confirmed BOOLEAN DEFAULT FALSE;

-- Add column for lead_id to link back to the lead
ALTER TABLE trial_lessons ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);
