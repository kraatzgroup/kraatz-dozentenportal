-- Angebot Einzelunterricht: Probestunde-Satz in "Nächste Schritte" als
-- optionalen Baustein schaltbar machen (<!--IF:probestunde-->…<!--/IF:probestunde-->).
UPDATE public.email_templates
SET body = replace(
  body,
  ' Gerne k&ouml;nnen wir auch eine <strong style="color:#000000;">kostenfreie Probestunde</strong> vereinbaren.',
  '<!--IF:probestunde--> Gerne k&ouml;nnen wir auch eine <strong style="color:#000000;">kostenfreie Probestunde</strong> vereinbaren.<!--/IF:probestunde-->'
),
updated_at = now()
WHERE id = 'angebot';
