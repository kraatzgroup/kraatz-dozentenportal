-- Klausuren Crashkurs + ELITE Kleingruppe: schaltbarer Telefonat-Baustein in "Nächste Schritte"
-- (<!--IF:telefonat-->…<!--/IF:telefonat-->), damit im Angebotsdialog "Nächstes Telefonat am …" verfügbar ist.
UPDATE public.email_templates
SET body = replace(body,
    'Wir telefonieren gerne in K&uuml;rze &ndash; ich rufe an. ',
    '<!--IF:telefonat-->Ich freue mich auf unser n&auml;chstes Telefonat und rufe Sie gerne an. <!--/IF:telefonat-->'),
  updated_at = now()
WHERE id = 'klausuren-crashkurs' AND body NOT LIKE '%<!--IF:telefonat-->%';

UPDATE public.email_templates
SET body = replace(body,
    '<p style="margin:0 0 14px;">F&uuml;r R&uuml;ckfragen stehe ich Ihnen jederzeit zur Verf&uuml;gung.',
    '<!--IF:telefonat--><p style="margin:0 0 14px;">Ich freue mich auf unser n&auml;chstes Telefonat und rufe Sie gerne an.</p><!--/IF:telefonat-->' || chr(10) || '<p style="margin:0 0 14px;">F&uuml;r R&uuml;ckfragen stehe ich Ihnen jederzeit zur Verf&uuml;gung.'),
  updated_at = now()
WHERE id = 'angebot-elite' AND body NOT LIKE '%<!--IF:telefonat-->%';
