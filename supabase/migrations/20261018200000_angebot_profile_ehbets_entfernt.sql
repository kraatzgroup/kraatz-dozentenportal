-- Angebots-Templates: Profil Stephan Ehbets (Kapellmann) entfernt, es bleiben vier Profile.
UPDATE public.email_templates
SET body = replace(
      regexp_replace(body, '<li><a href="https://kapellmann\.de/de/anwaelte/stephan-ehbets"[^>]*>[^<]*</a></li>\n?', ''),
      'exemplarisch fünf Profile', 'exemplarisch vier Profile'),
  updated_at = now()
WHERE id IN ('angebot', 'angebot-elite');
