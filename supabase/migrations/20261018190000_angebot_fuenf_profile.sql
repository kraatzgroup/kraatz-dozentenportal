-- Angebots-Templates: es sind fünf Profile ehemaliger Teilnehmer verlinkt.
UPDATE public.email_templates
SET body = replace(body, 'exemplarisch drei Profile', 'exemplarisch fünf Profile'),
  updated_at = now()
WHERE id IN ('angebot', 'angebot-elite');
