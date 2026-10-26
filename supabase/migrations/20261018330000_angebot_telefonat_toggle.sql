-- Angebot Einzelunterricht: Telefonat-Satz in "Nächste Schritte" als
-- optionalen Baustein schaltbar machen (<!--IF:telefonat-->…<!--/IF:telefonat-->).
UPDATE public.email_templates
SET body = replace(
  body,
  'Ich freue mich auf unser n&auml;chstes Telefonat und rufe Sie gerne an.',
  '<!--IF:telefonat-->Ich freue mich auf unser n&auml;chstes Telefonat und rufe Sie gerne an.<!--/IF:telefonat-->'
),
updated_at = now()
WHERE id = 'angebot';
