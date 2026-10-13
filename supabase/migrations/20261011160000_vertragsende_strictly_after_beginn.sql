-- Vertragsende muss mindestens einen Tag nach dem Vertragsbeginn liegen.
--
-- Bisher erlaubte die Check-Constraint vertragsende >= vertragsbeginn. Neu
-- gilt vertragsende > vertragsbeginn (mind. 1 Tag Unterschied). Bestehende
-- Einträge mit gleichem Begin/Ende werden automatisch auf +1 Tag korrigiert.

ALTER TABLE public.memberspot_kraatzclub_mitglieder
  DROP CONSTRAINT IF EXISTS memberspot_kraatzclub_mitglieder_check;

UPDATE public.memberspot_kraatzclub_mitglieder
SET vertragsende = vertragsbeginn + 1
WHERE vertragsende <= vertragsbeginn;

ALTER TABLE public.memberspot_kraatzclub_mitglieder
  ADD CONSTRAINT memberspot_kraatzclub_mitglieder_check
  CHECK (vertragsende > vertragsbeginn);