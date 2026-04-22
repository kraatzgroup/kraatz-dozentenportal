-- Add gender column to teilnehmer table
ALTER TABLE teilnehmer ADD COLUMN IF NOT EXISTS gender TEXT;
