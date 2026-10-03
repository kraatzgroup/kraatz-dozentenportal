-- Vertrieb: E-Mail-Templates für den Angebotsversand aus der Sales-Pipeline
--
-- 1. Sicherstellen, dass die email_templates-Tabelle existiert (falls sie nur
--    im Dashboard angelegt wurde, ist dies ein No-Op).
-- 2. Kategorie-Spalte ergänzen, damit das Angebot-Modal nur relevante
--    Vorlagen anbietet (category = 'angebot').
-- 3. Standard-Angebotsvorlage (HTML) seeden.
--
-- Bedingte Blöcke: <!--IF:paket-->…<!--/IF:paket-->, <!--IF:beginn-->…, <!--IF:angebot-->…
--   werden im Modal entfernt, wenn Paket bzw. Beginn nicht gesetzt sind.
-- Platzhalter (werden im Angebot-Modal ersetzt):
--   [Vorname] [Name] [Stundenpaket] [Stundenanzahl] [Preis] [Beginn]

CREATE TABLE IF NOT EXISTS public.email_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  icon TEXT DEFAULT '✉️',
  description TEXT,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  is_html BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'standard';

INSERT INTO public.email_templates (id, title, icon, description, subject, body, is_html, category)
VALUES (
  'angebot',
  'Angebot Einzelunterricht',
  '📄',
  'Ausführliches Angebot nach dem Beratungsgespräch',
  'Dein Einzelunterricht bei der Akademie Kraatz',
  $tpl$<div style="margin:0;padding:24px 12px;background-color:#F3F4FA;font-family:'Montserrat','Avenir','Avenir Next',Arial,sans-serif;color:#4E5D78;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">

<tr><td align="center" style="padding:28px 24px 20px;background-color:#FFFFFF;border-bottom:1px solid #E9ECEF;">
<img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Akademie Kraatz" style="height:64px;display:block;margin:0 auto;">
</td></tr>

<tr><td style="padding:36px 32px 8px;font-size:16px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 16px;">Hallo [Vorname],</p>
<p style="margin:0 0 16px;">vielen Dank für Deine Anfrage und unser angenehmes Gespräch vorhin. Gerne gebe ich Dir vorab einige Details zu Deinem effektiven Einzelunterricht bei der Akademie Kraatz.</p>
</td></tr>

<!--IF:angebot-->
<tr><td style="padding:8px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#2D84C1;border-radius:12px;">
<tr><td style="padding:22px 24px;color:#FFFFFF;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#D6E8F6;">Dein persönliches Angebot</p>
<!--IF:paket--><p style="margin:0 0 14px;font-size:22px;font-weight:700;color:#FFFFFF;">[Stundenpaket]</p><!--/IF:paket-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;color:#FFFFFF;">
<!--IF:paket--><tr><td style="padding:4px 0;">Umfang</td><td align="right" style="padding:4px 0;font-weight:600;">[Stundenanzahl] Stunden</td></tr>
<tr><td style="padding:4px 0;">Investition</td><td align="right" style="padding:4px 0;font-weight:600;">[Preis]</td></tr><!--/IF:paket-->
<!--IF:beginn--><tr><td style="padding:4px 0;">Geplanter Beginn</td><td align="right" style="padding:4px 0;font-weight:600;">[Beginn]</td></tr><!--/IF:beginn-->
</table>
</td></tr>
</table>
</td></tr>
<!--/IF:angebot-->

<tr><td style="padding:28px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Dein Einzelunterricht im Überblick</h2>
<p style="margin:0 0 14px;font-size:15px;line-height:1.7;"><strong style="color:#000000;">100% Aufmerksamkeit</strong> des Repetitors auf Dich &ndash; keine Massenveranstaltung, Du stehst im Mittelpunkt.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px 20px;font-size:15px;line-height:1.7;">
<strong style="color:#000000;">12 Monate Unterricht &middot; 140 Stunden</strong><br>
Zivilrecht (ZR): 55 Stunden<br>
Öffentliches Recht (ÖR): 50 Stunden<br>
Strafrecht (StR): 35 Stunden<br>
<span style="font-size:13px;">Flexible Stundenaufteilung &ndash; die Stunden können auch auf eine beliebige Monatsdauer verteilt werden.</span>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;">
<tr><td width="24" valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Unterrichtskonzept aus über 20 Jahren Erfahrung mit über 250.000 Stunden Unterricht</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Mehr als 4.200 Studenten und Referendare erfolgreich aufs Examen vorbereitet</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kooperationspartner von Advant Beiten, Heuking und Linklaters (Inhouse-Seminare)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kostenfreie Erstellung eines individuellen Lernplans</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Hochwertige, strukturierte und gut verständliche Unterrichtsmaterialien</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Top-Dozenten mit Prädikatsexamina (<strong>beide</strong> Examina), teils mit Prüfererfahrung am JPA</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Über 45 Dozenten verfügbar &ndash; <a href="https://kraatz-group.de/ueber-uns/unsere-dozenten/" style="color:#2D84C1;">zur Dozentenübersicht</a></td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kostenfreier Zugang zu ca. 800 Online-Videos bei Lecturio</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Dozentenwechsel jederzeit möglich &ndash; flexibel und unkompliziert</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Einzigartige Korrekturschemata</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Klausurkorrekturen innerhalb von 48 Stunden durch die Fachdozenten inklusive</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Flexible Unterrichtszeiten nach Deinen Wünschen</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kündigung des Unterrichtsvertrages jederzeit möglich &ndash; ohne Probleme</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Zusätzliche Einblicke</h2>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 8px 8px 0;"><a href="https://youtu.be/-rFJqAfufeo" style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">&#9654; Kraatz Club Einführung</a></td>
<td style="padding:0 0 8px 0;"><a href="https://youtu.be/2tUXBKvl3ag" style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">&#9654; Einzelunterricht</a></td>
</tr></table>
</td></tr>

<tr><td style="padding:20px 32px 4px;">
<h2 style="margin:0 0 8px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Kostenlose Probematerialien</h2>
<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Verschaffe Dir einen ersten Eindruck von unserem Kursmaterial:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 8px 8px 0;"><a href="https://kraatz-group.de/wp-content/uploads/2025/07/Zivilrecht-Probematerial.pdf" style="display:inline-block;border:2px solid #2D84C1;color:#2D84C1;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:8px;">Zivilrecht</a></td>
<td style="padding:0 8px 8px 0;"><a href="https://kraatz-group.de/wp-content/uploads/2025/07/Oeffentliches-Recht-Probematerial.pdf" style="display:inline-block;border:2px solid #2D84C1;color:#2D84C1;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:8px;">Öffentliches Recht</a></td>
<td style="padding:0 0 8px 0;"><a href="https://kraatz-group.de/wp-content/uploads/2025/07/Strafrecht-Probematerial.pdf" style="display:inline-block;border:2px solid #2D84C1;color:#2D84C1;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:8px;">Strafrecht</a></td>
</tr></table>
<p style="margin:8px 0 0;font-size:14px;line-height:1.7;">Als Kursteilnehmer erhältst Du außerdem unser <strong>Onlinerepetitorium</strong> (Wert 659,88 &euro;) kostenfrei dazu &ndash; eine einzigartige Kombination aus Präsenz- und Einzelunterricht.</p>
</td></tr>

<tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Preisübersicht</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.5;border-collapse:separate;border-spacing:0 8px;">
<tr><td style="background-color:#F3F4FA;padding:14px 16px;border-radius:10px 0 0 10px;"><strong style="color:#000000;">70 Stunden</strong><br><span style="font-size:12px;">12 Monate &agrave; 825,42 &euro; &middot; 141,50 &euro;/h (hälftiges Paket)</span></td><td align="right" style="background-color:#F3F4FA;padding:14px 16px;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;color:#2D84C1;white-space:nowrap;">9.905 &euro;</td></tr>
<tr><td style="background-color:#FFFFFF;padding:14px 16px;border:2px solid #2D84C1;border-right:0;border-radius:10px 0 0 10px;"><strong style="color:#000000;">140 Stunden</strong> <span style="background-color:#2D84C1;color:#FFFFFF;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;">TOP-SELLER</span><br><span style="font-size:12px;">12 Monate &agrave; 1.627,50 &euro; &middot; 139,50 &euro;/h</span></td><td align="right" style="background-color:#FFFFFF;padding:14px 16px;border:2px solid #2D84C1;border-left:0;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;color:#2D84C1;white-space:nowrap;">19.530 &euro;</td></tr>
<tr><td style="background-color:#F3F4FA;padding:14px 16px;border-radius:10px 0 0 10px;"><strong style="color:#000000;">200 Stunden</strong><br><span style="font-size:12px;">12 Monate &agrave; 2.308,34 &euro; &middot; 138,50 &euro;/h (inkl. 60 Std. Wiederholungspaket)</span></td><td align="right" style="background-color:#F3F4FA;padding:14px 16px;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;color:#2D84C1;white-space:nowrap;">27.700 &euro;</td></tr>
</table>
<p style="margin:12px 0 8px;font-size:14px;font-weight:600;color:#000000;">Rechtsgebiete einzeln buchbar</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.5;">
<tr><td style="padding:7px 0;border-bottom:1px solid #E9ECEF;">Zivilrecht <span style="font-size:12px;">&middot; 55 Std. &middot; 143,50 &euro;/h</span></td><td align="right" style="padding:7px 0;border-bottom:1px solid #E9ECEF;font-weight:700;color:#000000;">7.892,50 &euro;</td></tr>
<tr><td style="padding:7px 0;border-bottom:1px solid #E9ECEF;">Öffentliches Recht <span style="font-size:12px;">&middot; 50 Std. &middot; 143,50 &euro;/h</span></td><td align="right" style="padding:7px 0;border-bottom:1px solid #E9ECEF;font-weight:700;color:#000000;">7.175 &euro;</td></tr>
<tr><td style="padding:7px 0;">Strafrecht <span style="font-size:12px;">&middot; 35 Std. &middot; 143,50 &euro;/h</span></td><td align="right" style="padding:7px 0;font-weight:700;color:#000000;">5.022,50 &euro;</td></tr>
</table>
<p style="margin:12px 0 0;font-size:13px;line-height:1.6;">Gerne sind auch kleinere, individuelle Paketzusammenstellungen möglich &ndash; dazu mehr im nächsten Gespräch.</p>
</td></tr>

<tr><td style="padding:24px 32px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-left:5px solid #2D84C1;border-radius:10px;">
<tr><td style="padding:20px 22px;font-size:15px;line-height:1.7;">
<p style="margin:0 0 10px;font-weight:700;color:#000000;font-size:17px;">Motivationsschub für Deine Examensvorbereitung</p>
<p style="margin:0 0 10px;">Wir setzen den Fokus auf das Verständnis der wesentlichen Punkte statt auf bloßes Auswendiglernen. Ziel ist es, Dir das nötige &bdquo;Handwerkszeug&ldquo; zu vermitteln, damit Du sicher und erfolgreich in die Prüfung gehst.</p>
<p style="margin:0 0 10px;">Wir begleiten Dich mit Motivation, Einsatzbereitschaft und Erfolgserlebnissen, sodass diese intensive Zeit nicht als Last, sondern als produktive und bereichernde Phase empfunden wird.</p>
<a href="https://youtu.be/3V8r9lNDoSI" style="color:#2D84C1;font-weight:600;">&#9654; Persönliche Video-Botschaft von RA Mario Kraatz</a>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Das sagen unsere Teilnehmer</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.6;">
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Lisa Budich</strong><br><em>&bdquo;Ich bin überglücklich &ndash; ich habe das 1. Juristische Staatsexamen geschafft. Dieses unglaublich schöne Erfolgserlebnis habe ich auch der Akademie Kraatz zu verdanken.&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Alessandra Novelli</strong><br><em>&bdquo;Ich habe insgesamt im Staatsteil 8,81 Punkte. Damit habe ich eine Gesamtnote von 10,26 Punkten. Ich kann nur sagen, dass der Unterricht damit erfolgreich war!&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Franziska J.</strong><br><em>&bdquo;Nun ist es geschafft mit 9,57 Punkten im Zweiten Examen. Vielen Dank für die super Vorbereitung &ndash; die Dozenten waren fachlich wie menschlich wahnsinnig kompetent.&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Adrian Amann</strong><br><em>&bdquo;Die Dozenten sind wirklich erstklassig, super flexibel, antworten teils innerhalb weniger Minuten. Fachlich sowieso einwandfrei.&ldquo;</em></td></tr></table></td></tr>
</table>
<p style="margin:10px 0 0;font-size:13px;"><a href="https://kraatz-group.de/erfahrungsberichte" style="color:#2D84C1;font-weight:600;">Weitere Erfahrungsberichte ansehen &rarr;</a></p>
</td></tr>

<tr><td style="padding:24px 32px 32px;font-size:16px;line-height:1.7;color:#4E5D78;">
<h2 style="margin:0 0 12px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Nächste Schritte</h2>
<p style="margin:0 0 14px;">Gerne vereinbaren wir eine <strong style="color:#000000;">kostenfreie Probestunde</strong> oder sprechen noch einmal in Ruhe über Dein Paket. Für Rückfragen stehe ich Dir jederzeit zur Verfügung &ndash; gemeinsam gestalten wir Deine Examensvorbereitung erfolgreich.</p>
<p style="margin:0;">Ich wünsche Dir einen angenehmen Tag.<br><br><strong style="color:#000000;">Dein Team der Akademie Kraatz</strong></p>
</td></tr>

<tr><td align="center" style="padding:20px 24px;background-color:#F8F9FA;border-top:1px solid #E9ECEF;font-size:12px;line-height:1.7;color:#666666;">
Akademie Kraatz GmbH &middot; Wilmersdorfer Str. 145/146 &middot; 10585 Berlin<br>
<a href="https://www.instagram.com/kraatzgroup" style="color:#2D84C1;text-decoration:none;">Instagram</a> &middot;
<a href="https://www.youtube.com/@kraatzgroup" style="color:#2D84C1;text-decoration:none;">YouTube</a> &middot;
<a href="https://www.tiktok.com/@kraatzgroup" style="color:#2D84C1;text-decoration:none;">TikTok</a><br>
<a href="https://kraatz-group.de/impressum/" style="color:#666666;">Impressum</a> &middot;
<a href="https://kraatz-group.de/datenschutzerklaerung/" style="color:#666666;">Datenschutz</a>
</td></tr>

</table>
</div>$tpl$,
  true,
  'angebot'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  is_html = EXCLUDED.is_html,
  category = EXCLUDED.category,
  updated_at = now();
