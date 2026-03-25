-- Update TN-Nummer format constraint to allow 4 or 5 digits (TN0001-TN99999)
ALTER TABLE teilnehmer
DROP CONSTRAINT IF EXISTS teilnehmer_tn_nummer_format;

ALTER TABLE teilnehmer
ADD CONSTRAINT teilnehmer_tn_nummer_format 
CHECK (tn_nummer ~ '^TN[0-9]{4,5}$');
