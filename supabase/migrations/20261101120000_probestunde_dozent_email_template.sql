-- Probestunden: E-Mail-Benachrichtigung an den Dozenten bei einer neuen Anfrage.
-- Die Vorlage wird beim Anlegen einer Probestunde (createTrialLesson) über die
-- send-email-Function versendet. Platzhalter werden im Client ersetzt:
--   [Dozent_Name] [Teilnehmer] [Termin] [Dauer] [Rechtsgebiet]
--   [Kontakt] [Standort] [Landesrecht] [Notizen]
INSERT INTO public.email_templates (id, title, icon, description, subject, body, is_html, category)
VALUES (
  'probestunde-dozent',
  'Probestunde-Anfrage an Dozent',
  '🧑‍🏫',
  'Benachrichtigung an den Dozenten bei einer neuen Probestunden-Anfrage',
  'Neue Probestunden-Anfrage: [Teilnehmer]',
  $tpl$<div style="margin:0;padding:24px 12px;background-color:#F3F4FA;font-family:'Montserrat','Avenir','Avenir Next',Arial,sans-serif;color:#4E5D78;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;background-color:#FFFFFF;border-bottom:1px solid #E9ECEF;">
<p style="margin:0;font-size:22px;font-weight:700;color:#1F2937;">Neue Probestunden-Anfrage</p>
</td></tr>
<tr><td style="padding:28px 32px 12px;font-size:15px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 16px;">Hallo [Dozent_Name],</p>
<p style="margin:0 0 20px;">für Dich liegt eine neue Probestunden-Anfrage vor:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#4E5D78;">
<tr><td style="padding:5px 0;color:#9CA3AF;width:150px;">Teilnehmer:in</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Teilnehmer]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Termin</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Termin]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Dauer</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Dauer]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Rechtsgebiet</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Rechtsgebiet]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Uni-Standort</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Standort]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Landesrecht</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Landesrecht]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Kontakt</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Kontakt]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Notizen</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Notizen]</td></tr>
</table>
<p style="margin:20px 0 0;">Bitte gib kurz Bescheid, ob Du den Termin übernehmen kannst.</p>
</td></tr>
</table>
</div>$tpl$,
  true,
  'probestunde'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  is_html = EXCLUDED.is_html,
  category = EXCLUDED.category,
  updated_at = now();

-- E-Mail an den Admin, wenn ein Dozent eine Probestunde angenommen oder abgelehnt hat.
-- Platzhalter: [Dozent_Name] [Entscheidung] [Teilnehmer] [Termin] [Rechtsgebiet] [Dauer] [Kontakt]
INSERT INTO public.email_templates (id, title, icon, description, subject, body, is_html, category)
VALUES (
  'probestunde-dozent-antwort',
  'Probestunde: Dozenten-Antwort an Admin',
  '🔔',
  'Benachrichtigung an den Admin, wenn ein Dozent eine Probestunde angenommen oder abgelehnt hat',
  'Probestunde [Entscheidung]: [Teilnehmer] ([Dozent_Name])',
  $tpl$<div style="margin:0;padding:24px 12px;background-color:#F3F4FA;font-family:'Montserrat','Avenir','Avenir Next',Arial,sans-serif;color:#4E5D78;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;background-color:#FFFFFF;border-bottom:1px solid #E9ECEF;">
<p style="margin:0;font-size:22px;font-weight:700;color:#1F2937;">Probestunden-Antwort</p>
</td></tr>
<tr><td style="padding:28px 32px 12px;font-size:15px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 20px;">Dozent <strong>[Dozent_Name]</strong> hat die Probestunde <strong>[Entscheidung]</strong>:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#4E5D78;">
<tr><td style="padding:5px 0;color:#9CA3AF;width:150px;">Teilnehmer:in</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Teilnehmer]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Termin</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Termin]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Dauer</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Dauer]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Rechtsgebiet</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Rechtsgebiet]</td></tr>
<tr><td style="padding:5px 0;color:#9CA3AF;">Kontakt</td><td style="padding:5px 0;font-weight:600;color:#1F2937;">[Kontakt]</td></tr>
</table>
</td></tr>
</table>
</div>$tpl$,
  true,
  'probestunde'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  is_html = EXCLUDED.is_html,
  category = EXCLUDED.category,
  updated_at = now();