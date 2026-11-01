-- Klausuren Crashkurs vereinfacht: nur noch Platin/Gold zum Einheitspreis pro Klausur
-- (kein Bronze, keine Prüfer-Option), Klausuren-Anzahl im Überblick dynamisch,
-- Angebotskarte ([K_Karte]) im Stil des Einzelunterrichts statt Textzusammenfassung.
UPDATE public.email_templates
SET body = replace(replace(replace(replace(replace(body,
    '<tr><td style="padding:28px 32px 4px;"><p style="margin:0;font-size:15px;line-height:1.7;"><strong style="color:#000000;">[K_Zusammenfassung]</strong></p></td></tr>',
    '<tr><td style="padding:8px 32px 8px;">[K_Karte]</td></tr>'),
    'Zeitbedarf je Klausur: 1,5 Stunden &ndash; davon 0,5 Stunden Korrektur und 1,0 Stunden Besprechung per Zoom (alle Varianten siehe unten)',
    'Zeitbedarf je Klausur: &bdquo;Platin&ldquo; 1,5 Stunden (1,0 Stunden Besprechung per Zoom + 0,5 Stunden Korrektur), &bdquo;Gold&ldquo; 1,0 Stunden (nur Besprechung per Zoom, keine Korrektur)'),
    '<tr><td valign="top" style="padding:2px 6px 2px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:2px 0;">M&ouml;glichkeit der Korrektur durch ehemalige Pr&uuml;fer</td></tr>' || chr(10), ''),
    '<tr><td valign="top" style="padding:2px 6px 2px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:2px 0;">Korrektur ausschlie&szlig;lich durch Dozenten MIT Pr&uuml;fererfahrung (als Option, siehe unten)</td></tr>' || chr(10), ''),
    'mit der Besprechung von 6 Original-Klausuren', 'mit der Besprechung von [K_Anzahl] Original-Klausuren'),
  updated_at = now()
WHERE id = 'klausuren-crashkurs';
