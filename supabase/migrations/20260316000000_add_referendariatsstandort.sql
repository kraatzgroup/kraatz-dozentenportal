-- Add referendariatsstandort column to teilnehmer table
ALTER TABLE teilnehmer
ADD COLUMN IF NOT EXISTS referendariatsstandort TEXT;

COMMENT ON COLUMN teilnehmer.referendariatsstandort IS 'Standort des Referendariats für Teilnehmer im 2. Staatsexamen';
