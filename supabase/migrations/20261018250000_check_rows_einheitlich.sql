-- Haken-Zeilen: überall identisch (ohne feste Spaltenbreite, 2px Zeilenabstand).
UPDATE public.email_templates
SET body = replace(body, '<tr><td width="24" valign="top" style="padding:2px 0;color:#2D84C1;font-weight:700;">&#10003;</td>', '<tr><td valign="top" style="padding:2px 0;color:#2D84C1;font-weight:700;">&#10003;</td>'),
  updated_at = now()
WHERE body LIKE '%width="24" valign="top"%';
