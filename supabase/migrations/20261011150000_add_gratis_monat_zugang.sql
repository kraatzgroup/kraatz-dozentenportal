-- Fünfter Zugang "Gratis Monat" im Kraatz-Club-Formular.
--
-- "Gratis Monat" schaltet in Memberspot das Offer "1 Monat kostenlos im
-- Kraatz Club" frei. Im Formular wird dabei automatisch "Premium-Mitgliedschaft"
-- vorausgewählt und der Vertragszeitraum auf heute + 30 Tage gesetzt.
--
-- 1. Zugangs-Check erweitern
-- 2. Offer-Mapping ergänzen (nicht dauerhaft -> wird nach 30 Tagen entzogen)

ALTER TABLE public.memberspot_kraatzclub_mitglieder
  DROP CONSTRAINT IF EXISTS memberspot_kraatzclub_mitglieder_zugang_check;

ALTER TABLE public.memberspot_kraatzclub_mitglieder
  ADD CONSTRAINT memberspot_kraatzclub_mitglieder_zugang_check
  CHECK (
    cardinality(zugang) > 0
    AND zugang <@ ARRAY['Premium-Mitgliedschaft', 'Gratis Monat', 'Zivilrecht', 'Strafrecht', 'Öffentliches Recht']::text[]
  );

INSERT INTO public.memberspot_offer_mapping (zugang, offer_id, offer_label, dauerhaft) VALUES
  ('Gratis Monat', '6ac3b94f94d0635b0d7ff04c', '1 Monat kostenlos im Kraatz Club', FALSE)
ON CONFLICT (zugang) DO UPDATE SET
  offer_id = EXCLUDED.offer_id,
  offer_label = EXCLUDED.offer_label,
  dauerhaft = EXCLUDED.dauerhaft;