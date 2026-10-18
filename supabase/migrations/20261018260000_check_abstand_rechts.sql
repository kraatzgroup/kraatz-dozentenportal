-- Haken-Zeilen: 2px Abstand rechts vom Haken (zum Text), überall identisch.
UPDATE public.email_templates
SET body = replace(body,
      '<td valign="top" style="padding:2px 0;color:#2D84C1;font-weight:700;">&#10003;</td>',
      '<td valign="top" style="padding:2px 2px 2px 0;color:#2D84C1;font-weight:700;">&#10003;</td>'),
  updated_at = now()
WHERE body LIKE '%&#10003;%';
