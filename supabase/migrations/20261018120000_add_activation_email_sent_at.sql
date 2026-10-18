-- Aktivierungs-E-Mail erst zum Vertragsbeginn versenden.
--
-- Die Mail wird nicht mehr beim Speichern des Zugangs aus dem Portal versendet,
-- sondern von der Edge Function memberspot-kraatzclub-sync, sobald die
-- Freischaltung fällig ist (Vertragsbeginn erreicht; tägliche Prüfung um 00:15
-- Uhr deutscher Zeit, bei Vertragsbeginn "heute" sofort nach dem Speichern).
--
-- activation_email_sent_at verhindert doppelten Versand. Bestehende Mitglieder
-- haben ihre Mail bereits über das Portal erhalten und werden als versendet
-- markiert.

ALTER TABLE public.memberspot_kraatzclub_mitglieder
  ADD COLUMN IF NOT EXISTS activation_email_sent_at TIMESTAMPTZ;

UPDATE public.memberspot_kraatzclub_mitglieder
SET activation_email_sent_at = now()
WHERE activation_email_sent_at IS NULL;
