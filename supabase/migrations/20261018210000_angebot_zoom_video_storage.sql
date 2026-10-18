-- Online-Unterricht-Video: eigenes Supabase-Storage-Video (Videos-Portal/akademie-kraatz) mit Thumbnail statt Dropbox-Link.
UPDATE public.email_templates SET body = $tpl$<div style="margin:0;padding:24px 12px;background-color:#F3F4FA;font-family:'Montserrat','Avenir','Avenir Next',Arial,sans-serif;color:#4E5D78;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">

<tr><td align="center" style="padding:28px 24px 20px;background-color:#FFFFFF;border-bottom:1px solid #E9ECEF;">
<img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Akademie Kraatz" style="height:64px;display:block;margin:0 auto;">
</td></tr>

<tr><td style="padding:36px 32px 8px;font-size:16px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 16px;">[Anrede_Gruss],</p>
<p style="margin:0 0 16px;">vielen Dank für Ihre Anfrage und unser angenehmes Gespräch vorhin. Gerne möchte ich Ihnen vorab einige Details zu Ihrem effektiven Einzelunterricht bei der Akademie Kraatz mitteilen:</p>
</td></tr>

<!--IF:angebot-->
<tr><td style="padding:8px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="[Karte_Stil]border-radius:12px;"><tr><td style="padding:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid [Karte_Rahmen];border-radius:8px;">
<tr><td style="padding:12px;[Karte_Muster]"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid [Karte_Rahmen];border-radius:6px;[Karte_Stil]"><tr><td style="padding:16px 18px;color:[Karte_Text];">
<p style="margin:0 0 12px;text-align:center;"><span style="display:inline-block;background-color:[Karte_Rahmen];color:[Karte_Tag_Text];font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:12px;">Ihr persönliches Angebot</span></p>
<!--IF:paket--><p style="margin:0 0 14px;font-size:22px;font-weight:400;color:[Karte_Titel];">[Stundenpaket]</p><!--/IF:paket-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;color:[Karte_Text];">
<!--IF:paket--><tr><td style="padding:4px 0;">Umfang</td><td align="right" style="padding:4px 0;font-weight:600;">[Stundenanzahl] Stunden</td></tr>
<tr><td style="padding:4px 0;">Laufzeit</td><td align="right" style="padding:4px 0;font-weight:600;">[Laufzeit]</td></tr>
<tr><td style="padding:4px 0;">Investition</td><td align="right" style="padding:4px 0;font-weight:600;">[Preis]</td></tr>
<tr><td style="padding:4px 0;">Monatliche Rate</td><td align="right" style="padding:4px 0;font-weight:600;">[Monatsrate]</td></tr><!--/IF:paket-->
<!--IF:beginn--><tr><td style="padding:4px 0;">Geplanter Beginn</td><td align="right" style="padding:4px 0;font-weight:600;">[Beginn]</td></tr><!--/IF:beginn-->
</table>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<!--/IF:angebot-->

<!--SECTION:ueberblick--><tr><td style="padding:28px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Ihr Einzelunterricht im Überblick</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px 20px;font-size:15px;line-height:1.7;">
<strong style="color:#000000;">[Stundenpaket]<!--IF:paket--> &middot; [Laufzeit] &middot; [Stundenanzahl] Stunden<!--/IF:paket--></strong><br>
Zivilrecht (ZR): [Stunden_ZR] Stunden (Stoff wird u.a. anhand von [Klausuren_ZR] Examensklausuren besprochen)<br>
Öffentliches Recht (ÖR): [Stunden_OER] Stunden (Stoff wird u.a. anhand von [Klausuren_OER] Examensklausuren besprochen)<br>
Strafrecht (StR): [Stunden_STR] Stunden (Stoff wird u.a. anhand von [Klausuren_STR] Examensklausuren besprochen)<br>
<span style="font-size:13px;">Flexible Stundenaufteilung &ndash; die Stunden können individuell auf die Rechtsgebiete verteilt werden.</span>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;">
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;"><strong style="color:#000000;">100% Aufmerksamkeit</strong> des Repetitors auf Sie mit 12 Monaten Einzelunterricht (genauere Übersicht zu den Kursvarianten und Möglichkeiten unten)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Unterrichtskonzept, das auf über 22 Jahren Erfahrung mit über 275.000 Stunden Unterrichtserfahrung beruht</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Wir sind nach umfassender Prüfung durch die ZfU (Zentrale für Fernunterrichtslehrgänge) zertifiziert, ordnungsgemäß auf alle juristischen Prüfungen vom Grundstudium bis zum 2. Examen vorzubereiten</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Mehr als 4.800 Studenten und Referendare haben wir in 22 Jahren erfolgreich auf das Examen vorbereitet</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Wir übernehmen als Kooperationspartner für u.a. die Kanzleien Hengeler Mueller, Linklaters und A &amp; O Sherman im Rahmen von Inhouse-Seminaren die Ausbildung von Referendaren und wissenschaftlichen Mitarbeitern</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Einen Link zu unseren Rezensionen/Zertifikaten und Kanzleipartnern finden Sie hier: <a href="https://beratung.kraatz-group.de/zeugnisse-dozenten" style="color:#2D84C1;">Zeugnisse &amp; Dozenten</a></td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Keine Massenveranstaltung &ndash; Sie stehen im Mittelpunkt!</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kostenfreie Erstellung eines individuellen Lernplans</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Ständiges Leistungsmonitoring (zum Kursbeginn erfolgt eine Sachstandsanalyse und Ihre Leistungsverbesserung wird nachvollziehbar dokumentiert)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Hochwertige, strukturierte und gut verständliche Unterrichtsmaterialien</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Top-Dozenten mit Prädikatsexamina (<strong>beide</strong> Examina) und mehrjähriger Unterrichtserfahrung, einige sogar mit Prüfererfahrung am JPA (<a href="https://kraatz-group.de/ueber-uns/unsere-dozenten/" style="color:#2D84C1;">Dozentenliste</a>)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Über 50 Dozenten mit Prädikatsexamina in der Kraatz Group, deren Art des Unterrichtens nach Kraatz-Qualitätsstandards aus 22 Jahren Erfahrung einheitlich festgelegt ist (bedeutet: &bdquo;keine Dozentenlotterie&ldquo; für Sie)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Exklusiv für Sie als [Kursteilnehmer]: Kostenloser Zugang zu unseren ca. 800 Online-Lernvideos bei uns im Kraatz Club inklusive</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Dozentenwechsel jederzeit möglich &ndash; flexibel und unkompliziert (denn hier treffen &bdquo;Menschen aufeinander&ldquo;, sollte es mal nicht persönlich passen, haben Sie &bdquo;von heute auf morgen&ldquo; einen neuen Dozenten)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Einzigartige Korrekturschemata (damit wird Ihre Benotung endlich nachvollziehbar und Schwachstellen werden schnell ersichtlich)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kündigung des Unterrichtsvertrages jederzeit möglich &ndash; ohne Probleme</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Ausführliche Klausurkorrekturen innerhalb von 48 Stunden durch die Fachdozenten inklusive (KEINE Korrekturassistenten, damit erhalten Sie Feedback &bdquo;aus erster Hand&ldquo; im Unterricht)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Flexible Unterrichtszeiten nach Ihren Wünschen</td></tr>
</table>
</td></tr><!--/SECTION:ueberblick-->

<!--SECTION:einblicke--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Zusätzliche Einblicke</h2>
<p style="margin:0 0 10px;font-size:15px;line-height:1.7;">Anbei finden Sie einige Mustermaterialien aus unserem Kursprogramm, darunter:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;margin-bottom:10px;">
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Klausuren</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">und weitere Übersichten</td></tr>
</table>
<p style="margin:0 0 12px;font-size:14px;line-height:1.7;">Außerdem erhalten Sie als [Kursteilnehmer] einen kostenlosen Zugriff auf unser <strong>Onlinerepetitorium</strong> des Kraatz Clubs (Wert 659,88 &euro;). So bieten wir eine einzigartige und ideale Kombination von Präsenz- und Einzelunterricht.</p>
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#000000;">Beispielvideos</p>
<div style="margin:0 0 12px;"><a href="https://youtu.be/-rFJqAfufeo?si=exG6T66FuWUBBq3u" style="display:block;max-width:320px;text-decoration:none;"><img src="https://img.youtube.com/vi/-rFJqAfufeo/hqdefault.jpg" width="320" alt="Grundlagen der GOA &ndash; Kraatz Club" style="display:block;width:100%;max-width:320px;height:auto;border-radius:10px;border:1px solid #E9ECEF;"></a><p style="margin:6px 0 0;font-size:13px;line-height:1.5;"><a href="https://youtu.be/-rFJqAfufeo?si=exG6T66FuWUBBq3u" style="color:#2D84C1;font-weight:600;text-decoration:none;">&#9654; Grundlagen der GOA &ndash; Kraatz Club</a></p></div><div style="margin:0 0 12px;"><a href="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht.mp4" style="display:block;max-width:320px;text-decoration:none;"><img src="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht_thumb.jpg" width="320" alt="Online-Unterricht per ZOOM" style="display:block;width:100%;max-width:320px;height:auto;border-radius:10px;border:1px solid #E9ECEF;"></a><p style="margin:6px 0 0;font-size:13px;line-height:1.5;"><a href="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht.mp4" style="color:#2D84C1;font-weight:600;text-decoration:none;">&#9654; Online-Unterricht per ZOOM</a></p></div>
</td></tr><!--/SECTION:einblicke-->

<!--SECTION:probematerial--><tr><td style="padding:20px 32px 4px;">
<h2 style="margin:0 0 8px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Kostenlose Probematerialien</h2>
<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Verschaffen Sie sich einen ersten Eindruck von unserem Kursmaterial:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 8px 8px 0;"><a href="https://kraatz-group.de/wp-content/uploads/2025/07/Zivilrecht-Probematerial.pdf" style="display:inline-block;border:2px solid #2D84C1;color:#2D84C1;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:8px;">Zivilrecht</a></td>
<td style="padding:0 8px 8px 0;"><a href="https://kraatz-group.de/wp-content/uploads/2025/07/Oeffentliches-Recht-Probematerial.pdf" style="display:inline-block;border:2px solid #2D84C1;color:#2D84C1;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:8px;">Öffentliches Recht</a></td>
<td style="padding:0 0 8px 0;"><a href="https://kraatz-group.de/wp-content/uploads/2025/07/Strafrecht-Probematerial.pdf" style="display:inline-block;border:2px solid #2D84C1;color:#2D84C1;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:8px;">Strafrecht</a></td>
</tr></table>
</td></tr><!--/SECTION:probematerial-->

<!--SECTION:preisuebersicht--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Ihr Investment in Ihre Zukunft &ndash; Preisübersicht und grobe Inhaltsübersicht</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.5;border-collapse:separate;border-spacing:0 8px;">
<tr><td style="background-color:#CFD6DE;background-image:linear-gradient(135deg,#F8FAFC 0%,#CFD6DE 25%,#FFFFFF 45%,#AEB7C2 70%,#E9EDF1 100%);color:#334155;padding:14px 16px;border-radius:10px 0 0 10px;[Platin_Rahmen_L]"><strong>Einzelunterricht 1. Staatsexamen | PLATIN</strong> [Platin_Tag]<br><span style="font-size:12px;">140 Unterrichtsstunden &middot; alle Rechtsgebiete &middot; [Laufzeit] &agrave; [Platin_Rate] &middot; [Platin_Stundenpreis]/h</span></td><td align="right" style="background-color:#CFD6DE;background-image:linear-gradient(135deg,#F8FAFC 0%,#CFD6DE 25%,#FFFFFF 45%,#AEB7C2 70%,#E9EDF1 100%);color:#334155;padding:14px 16px;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;white-space:nowrap;[Platin_Rahmen_R]">[Platin_Preis]</td></tr>
<tr><td style="background-color:#E8C14F;background-image:linear-gradient(135deg,#FFF6C9 0%,#E8C14F 25%,#FFF3B0 45%,#C9972B 70%,#F3D878 100%);color:#5A3D00;padding:14px 16px;border-radius:10px 0 0 10px;[Gold_Rahmen_L]"><strong>Einzelunterricht 1. Staatsexamen | GOLD</strong> [Gold_Tag]<br><span style="font-size:12px;">70 Unterrichtsstunden &middot; alle Rechtsgebiete &middot; [Laufzeit] &agrave; [Gold_Rate] &middot; [Gold_Stundenpreis]/h</span></td><td align="right" style="background-color:#E8C14F;background-image:linear-gradient(135deg,#FFF6C9 0%,#E8C14F 25%,#FFF3B0 45%,#C9972B 70%,#F3D878 100%);color:#5A3D00;padding:14px 16px;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;white-space:nowrap;[Gold_Rahmen_R]">[Gold_Preis]</td></tr>
[Individuell_Zeile]
</table>
<p style="margin:12px 0 6px;font-size:14px;font-weight:600;color:#000000;">Möglichkeiten: ALLE Rechtsgebiete im Paket</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.7;"><strong style="color:#000000;">PLATIN</strong> (komplette Examensvorbereitung, TOP-Seller) mit 140 Stunden Unterricht:<br>
Zivilrecht (ZR): 55 Stunden (Stoff wird u.a. anhand von 40 Examensklausuren besprochen)<br>
Öffentliches Recht (ÖR): 50 Stunden (Stoff wird u.a. anhand von 34 Examensklausuren besprochen)<br>
Strafrecht (StR): 35 Stunden (Stoff wird u.a. anhand von 29 Examensklausuren besprochen)</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.7;"><strong style="color:#000000;">GOLD</strong> (komplette Examensvorbereitung, es wird jede 2. Klausur durchbesprochen; Sie erhalten aber gleichwohl, wie beim PLATIN-Paket, ALLE Klausuren/Materialien vollständig und arbeiten die nicht besprochenen Klausuren allein durch &ndash; Fragen, die dabei aufkommen, können selbstverständlich gestellt werden) mit 70 Stunden:<br>
Zivilrecht (ZR): 27,5 Stunden (Stoff wird u.a. anhand von 20 Examensklausuren besprochen)<br>
Öffentliches Recht (ÖR): 25 Stunden (Stoff wird u.a. anhand von 17 Examensklausuren besprochen)<br>
Strafrecht (StR): 17,5 Stunden (Stoff wird u.a. anhand von 15 Examensklausuren besprochen)</p>
<p style="margin:0 0 14px;font-size:13px;line-height:1.6;">Gerne auch kleinere, individuelle Paketzusammenstellungen möglich &ndash; die Stundenverteilung auf die Rechtsgebiete und der Gesamtumfang können individuell angepasst werden.</p>
<p style="margin:0 0 10px;font-size:14px;line-height:1.7;">Das Examen ist eine der wichtigsten Weichenstellungen der juristischen Ausbildung. Schon wenige Punkte Unterschied k&ouml;nnen sich erheblich auf sp&auml;tere Karrierechancen, berufliche Entwicklung und Einkommensm&ouml;glichkeiten auswirken. Vor diesem Hintergrund verstehen viele unserer Kandidatinnen und Kandidaten (ca. 450&ndash;500 TN/Jahr im Einzelunterricht) die gezielte Vorbereitung nicht als blo&szlig;en Kostenpunkt, sondern als bewusstes Investment in eine Zukunft, deren Mehrwert den urspr&uuml;nglichen Aufwand h&auml;ufig um ein Vielfaches &uuml;bersteigt.</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.7;">Nicht wenige unserer ehemaligen Absolventen arbeiten heute (u.a.) in Top-Wirtschaftskanzleien mit herausragender Verg&uuml;tung. Nur exemplarisch vier Profile ehemaliger Teilnehmer (alle mit DOPPEL-PR&Auml;DIKAT):</p>
<ul style="margin:0 0 4px;padding-left:20px;font-size:14px;line-height:1.8;">
<li><a href="https://www.osborneclarke.com/de/lawyers/julian-s-tristram" style="color:#2D84C1;">Julian S. Tristram (Osborne Clarke)</a></li>
<li><a href="https://neon.law/people/thomas-haertinger" style="color:#2D84C1;">Thomas H&auml;rtinger (neon.law)</a></li>
<li><a href="https://cms.law/de/deu/personen/viola-raue" style="color:#2D84C1;">Viola Raue (CMS)</a></li>
<li><a href="https://www.quinnemanuel.com/attorneys/bergann-franz/" style="color:#2D84C1;">Bergann Franz (Quinn Emanuel)</a></li>
</ul>
</td></tr><!--/SECTION:preisuebersicht-->

<!--SECTION:motivation--><tr><td style="padding:24px 32px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-left:5px solid #2D84C1;border-radius:10px;">
<tr><td style="padding:20px 22px;font-size:15px;line-height:1.7;">
<p style="margin:0 0 10px;font-weight:700;color:#000000;font-size:17px;">Motivationsschub f&uuml;r Ihre Examensvorbereitung</p>
<p style="margin:0 0 10px;">Wir setzen den Fokus auf das Verst&auml;ndnis der wesentlichen Punkte, statt auf blo&szlig;es Auswendiglernen. Ziel ist es, Ihnen das n&ouml;tige &bdquo;Handwerkszeug&ldquo; zu vermitteln, damit Sie sicher und erfolgreich in die Pr&uuml;fung gehen k&ouml;nnen.</p>
<p style="margin:0 0 10px;">Wir begleiten Sie mit Motivation, Einsatzbereitschaft und Erfolgserlebnissen durch die Examensvorbereitung, sodass diese intensive Zeit nicht als Last, sondern als produktive und bereichernde Phase Ihres Wissensaufbaus empfunden wird.</p>
<p style="margin:0 0 6px;">&#9654; Rezensionen: Lesen Sie <a href="https://www.google.com/search?q=Akademie+Kraatz" style="color:#2D84C1;font-weight:600;">Kundenmeinungen</a> oder sehen Sie sich die Erfolgsgeschichten unten an.</p>
<div style="margin:0 0 12px;"><a href="https://www.loom.com/share/662c8487720e4bf3abc1f0dfdd5678fe" style="display:block;max-width:320px;text-decoration:none;"><img src="https://cdn.loom.com/sessions/thumbnails/662c8487720e4bf3abc1f0dfdd5678fe-fd07b46f073af0c2.gif" width="320" alt="Pers&ouml;nliches Video von unserem Gr&uuml;nder RA Mario Kraatz" style="display:block;width:100%;max-width:320px;height:auto;border-radius:10px;border:1px solid #E9ECEF;"></a><p style="margin:6px 0 0;font-size:13px;line-height:1.5;"><a href="https://www.loom.com/share/662c8487720e4bf3abc1f0dfdd5678fe" style="color:#2D84C1;font-weight:600;text-decoration:none;">&#9654; Pers&ouml;nliches Video von unserem Gr&uuml;nder RA Mario Kraatz</a></p></div>
</td></tr>
</table>
</td></tr><!--/SECTION:motivation-->

<!--SECTION:testimonials--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Das sagen unsere Teilnehmer</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.6;">
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Lisa Budich</strong><br><em>&bdquo;Ich bin überglücklich &ndash; ich habe das 1. Juristische Staatsexamen geschafft. Dieses unglaublich schöne Erfolgserlebnis habe ich auch der Akademie Kraatz zu verdanken.&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Alessandra Novelli</strong><br><em>&bdquo;Ich habe insgesamt im Staatsteil 8,81 Punkte. Damit habe ich eine Gesamtnote von 10,26 Punkten. Ich kann nur sagen, dass der Unterricht damit erfolgreich war!&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Franziska J.</strong><br><em>&bdquo;Nun ist es geschafft mit 9,57 Punkten im Zweiten Examen. Vielen Dank für die super Vorbereitung &ndash; die Dozenten waren fachlich wie menschlich wahnsinnig kompetent.&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Adrian Amann</strong><br><em>&bdquo;Die Dozenten sind wirklich erstklassig, super flexibel, antworten teils innerhalb weniger Minuten. Fachlich sowieso einwandfrei.&ldquo;</em></td></tr></table></td></tr>
</table>
<p style="margin:10px 0 0;font-size:13px;"><a href="https://kraatz-group.de/erfahrungsberichte" style="color:#2D84C1;font-weight:600;">Weitere Erfahrungsberichte ansehen &rarr;</a></p>
</td></tr><!--/SECTION:testimonials-->

<!--SECTION:naechste-schritte--><tr><td style="padding:24px 32px 32px;font-size:16px;line-height:1.7;color:#4E5D78;">
<h2 style="margin:0 0 12px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">N&auml;chste Schritte</h2>
<p style="margin:0 0 14px;">Ich freue mich auf unser n&auml;chstes Telefonat und rufe Sie gerne an. Gerne k&ouml;nnen wir auch eine <strong style="color:#000000;">kostenfreie Probestunde</strong> vereinbaren.</p>
<p style="margin:0 0 14px;">F&uuml;r R&uuml;ckfragen stehe ich Ihnen jederzeit zur Verf&uuml;gung. Gemeinsam werden wir Ihre Examensvorbereitung erfolgreich gestalten! &#128522;</p>
<p style="margin:0;">Ich w&uuml;nsche Ihnen einen angenehmen Tag.<br><br>Mit freundlichen Gr&uuml;&szlig;en,<br><strong style="color:#000000;">RA Mario Kraatz</strong></p>
</td></tr><!--/SECTION:naechste-schritte-->

<tr><td align="center" style="padding:20px 24px;background-color:#F8F9FA;border-top:1px solid #E9ECEF;font-size:12px;line-height:1.7;color:#666666;">
Akademie Kraatz GmbH &middot; Wilmersdorfer Str. 145/146 &middot; 10585 Berlin<br>
<span style="color:#666666;">&Uuml;brigens, Sie finden uns auch auf</span><br>
<a href="https://www.youtube.com/channel/UCelspPjl7qVPqa5Ga7povTQ" style="color:#2D84C1;text-decoration:none;">YouTube</a> &middot;
<a href="https://de-de.facebook.com/meinjurarepetitorium/" style="color:#2D84C1;text-decoration:none;">Facebook</a> &middot;
<a href="https://www.instagram.com/akademiekraatz/" style="color:#2D84C1;text-decoration:none;">Instagram</a> &middot;
<a href="https://www.tiktok.com/@kraatzgroup" style="color:#2D84C1;text-decoration:none;">TikTok</a><br>
<a href="https://kraatz-group.de/impressum/" style="color:#666666;">Impressum</a> &middot;
<a href="https://kraatz-group.de/datenschutzerklaerung/" style="color:#666666;">Datenschutz</a>
</td></tr>

</table>
</div>$tpl$, updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = $tpl$<div style="margin:0;padding:24px 12px;background-color:#F3F4FA;font-family:'Montserrat','Avenir','Avenir Next',Arial,sans-serif;color:#4E5D78;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">

<tr><td align="center" style="padding:28px 24px 20px;background-color:#FFFFFF;border-bottom:1px solid #E9ECEF;">
<img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Akademie Kraatz" style="height:64px;display:block;margin:0 auto;">
</td></tr>

<tr><td style="padding:36px 32px 8px;font-size:16px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 16px;">[Anrede_Gruss],</p>
<p style="margin:0 0 16px;">vielen Dank für Ihre Anfrage und unser heute geführtes Telefonat. Ich erlaube mir, Ihnen schon einmal vorab einige Infos zu Ihrem effektiven <strong style="color:#000000;">ELITE Kleingruppenunterricht</strong> bei der Akademie Kraatz zu geben.</p>
</td></tr>

<!--IF:angebot-->
<tr><td style="padding:8px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="[Karte_Stil]border-radius:12px;"><tr><td style="padding:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid [Karte_Rahmen];border-radius:8px;">
<tr><td style="padding:12px;[Karte_Muster]"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid [Karte_Rahmen];border-radius:6px;[Karte_Stil]"><tr><td style="padding:16px 18px;color:[Karte_Text];">
<p style="margin:0 0 12px;text-align:center;"><span style="display:inline-block;background-color:[Karte_Rahmen];color:[Karte_Tag_Text];font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:12px;">Ihr persönliches Angebot</span></p>
<p style="margin:0 0 14px;font-size:22px;font-weight:400;color:[Karte_Titel];">[Stundenpaket]</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;color:[Karte_Text];">
<tr><td style="padding:4px 0;">Gruppengr&ouml;&szlig;e</td><td align="right" style="padding:4px 0;font-weight:600;">max. 8 Teilnehmer</td></tr>
<tr><td style="padding:4px 0;">Umfang</td><td align="right" style="padding:4px 0;font-weight:600;">310 Std. + 72 Std. Wiederholung = [Stundenanzahl] Std.</td></tr>
<tr><td style="padding:4px 0;">Laufzeit</td><td align="right" style="padding:4px 0;font-weight:600;">[Laufzeit] Unterricht</td></tr>
<tr><td style="padding:4px 0;">Investition</td><td align="right" style="padding:4px 0;font-weight:600;">[Preis]</td></tr>
<tr><td style="padding:4px 0;">Ratenzahlung</td><td align="right" style="padding:4px 0;font-weight:600;">13 &times; [Monatsrate]</td></tr>
<!--IF:beginn--><tr><td style="padding:4px 0;">Geplanter Beginn</td><td align="right" style="padding:4px 0;font-weight:600;">[Beginn]</td></tr><!--/IF:beginn-->
</table>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<!--/IF:angebot-->

<!--SECTION:ueberblick--><tr><td style="padding:28px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Ihr Unterricht im &Uuml;berblick</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px 20px;font-size:15px;line-height:1.7;">
<strong style="color:#000000;">ELITE Kleingruppe &middot; max. 8 Teilnehmer &middot; 12 Monate &middot; 310 Stunden Unterricht</strong><br>
Zivilrecht (ZR): 120 Stunden<br>
&Ouml;ffentliches Recht (&Ouml;R): 100 Stunden<br>
Strafrecht (StR): 90 Stunden<br>
<span style="font-size:13px;">zzgl. 72 Std. Wiederholungsstunden = 382 Std. Unterricht insgesamt</span>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;">
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;"><strong style="color:#000000;">100% Aufmerksamkeit</strong> des Repetitors auf Sie mit max. 8 Teilnehmern in der ELITE Kleingruppe &ndash; keine Massenveranstaltung, Sie stehen mit Ihrer kleinen Gruppe im Mittelpunkt</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Unterrichtskonzept, das auf &uuml;ber 22 Jahren Erfahrung beruht</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Mehr als 4.800 Studenten und Referendare haben wir in 22 Jahren erfolgreich auf das Examen vorbereitet</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Zertifiziert durch die ZfU (Zentrale f&uuml;r Fernunterrichtslehrg&auml;nge): ordnungsgem&auml;&szlig;e Vorbereitung auf alle juristischen Pr&uuml;fungen vom Grundstudium bis zum 2. Examen</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kooperationspartner u.a. f&uuml;r die Kanzleien Hengeler Mueller, Linklaters und A &amp; O Sherman im Rahmen von Inhouse-Seminaren (Ausbildung von Referendaren und wissenschaftlichen Mitarbeitern)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Rezensionen, Zertifikate und Kanzleipartner: <a href="https://beratung.kraatz-group.de/zeugnisse-dozenten" style="color:#2D84C1;">zu den Zeugnissen &amp; Dozenten</a></td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kostenfreie Erstellung eines individuellen Lernplans</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Hochwertige, strukturierte und gut verst&auml;ndliche Unterrichtsmaterialien</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">105 Klausuren aus ZR, &Ouml;R und StR, die den kompletten Stoff f&uuml;r das Examen nahezu abdecken</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Top-Dozenten mit Pr&auml;dikatsexamina (<strong>beide</strong> Examina) und mehrj&auml;hriger Unterrichtserfahrung</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kostenfreier Zugang zu unseren Online-Videos im Kraatz Club</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Klausurkorrekturen inklusive</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Kurseinstiege immer im April und Oktober m&ouml;glich</td></tr>
</table>
</td></tr><!--/SECTION:ueberblick-->

<!--SECTION:einblicke--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Zus&auml;tzliche Einblicke</h2>
<p style="margin:0 0 10px;font-size:15px;line-height:1.7;">Anbei finden Sie einige Mustermaterialien zur Ansicht aus unserem Kursprogramm, darunter:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;margin-bottom:10px;">
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Lehrpl&auml;ne (Unterrichtsplan, Videoplan f&uuml;r das &bdquo;blended learning&ldquo;)</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">Klausuren</td></tr>
<tr><td valign="top" style="padding:5px 0;color:#2D84C1;font-weight:700;">&#10003;</td><td style="padding:5px 0;">und weitere hilfreiche &Uuml;bersichten</td></tr>
</table>
<p style="margin:0 0 12px;font-size:14px;line-height:1.7;">Zus&auml;tzlich erhalten Sie als [Kursteilnehmer] unser <strong>Onlinerepetitorium</strong> (im Wert von 659,88 &euro;, f&uuml;r Sie kostenfrei) dazu &ndash; damit bieten wir Ihnen eine konkurrenzlose Kombination von Pr&auml;senz- und Einzelunterricht.</p>
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#000000;">Beispielvideos</p>
<div style="margin:0 0 12px;"><a href="https://youtu.be/-rFJqAfufeo?si=exG6T66FuWUBBq3u" style="display:block;max-width:320px;text-decoration:none;"><img src="https://img.youtube.com/vi/-rFJqAfufeo/hqdefault.jpg" width="320" alt="Grundlagen der GOA &ndash; Kraatz Club" style="display:block;width:100%;max-width:320px;height:auto;border-radius:10px;border:1px solid #E9ECEF;"></a><p style="margin:6px 0 0;font-size:13px;line-height:1.5;"><a href="https://youtu.be/-rFJqAfufeo?si=exG6T66FuWUBBq3u" style="color:#2D84C1;font-weight:600;text-decoration:none;">&#9654; Grundlagen der GOA &ndash; Kraatz Club</a></p></div><div style="margin:0 0 12px;"><a href="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht.mp4" style="display:block;max-width:320px;text-decoration:none;"><img src="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht_thumb.jpg" width="320" alt="Online-Unterricht per ZOOM" style="display:block;width:100%;max-width:320px;height:auto;border-radius:10px;border:1px solid #E9ECEF;"></a><p style="margin:6px 0 0;font-size:13px;line-height:1.5;"><a href="https://gkkveloqajxghhflkfru.supabase.co/storage/v1/object/public/Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht.mp4" style="color:#2D84C1;font-weight:600;text-decoration:none;">&#9654; Online-Unterricht per ZOOM</a></p></div>
</td></tr><!--/SECTION:einblicke-->

<!--SECTION:preisuebersicht--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Preis&uuml;bersicht</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.5;border-collapse:separate;border-spacing:0 8px;">
<tr><td style="background-color:#BFE3C5;background-image:linear-gradient(135deg,#E6F6E8 0%,#BFE3C5 25%,#F2FBF3 45%,#9ECDA6 70%,#D4EED8 100%);color:#1F5130;padding:14px 16px;border-radius:10px 0 0 10px;border:3px solid #1F5130;border-right:0;"><strong>[Stundenpaket]</strong> <span style="display:inline-block;background-color:#1F5130;color:#FFFFFF;font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 9px;border-radius:10px;vertical-align:middle;">DEIN PAKET</span><br><span style="font-size:12px;">max. 8 Teilnehmer &middot; 382 Unterrichtsstunden inkl. 72 Std. Wiederholung &middot; 12 Monate Unterricht</span></td><td align="right" style="background-color:#BFE3C5;background-image:linear-gradient(135deg,#E6F6E8 0%,#BFE3C5 25%,#F2FBF3 45%,#9ECDA6 70%,#D4EED8 100%);color:#1F5130;padding:14px 16px;border-radius:0 10px 10px 0;border:3px solid #1F5130;border-left:0;font-size:18px;font-weight:700;white-space:nowrap;">[Preis]</td></tr>
</table>
<p style="margin:4px 0 14px;font-size:13px;line-height:1.6;">Ratenzahlung in 13 Monatsraten &agrave; [Monatsrate]: Die erste Rate wird sofort bei Vertragsschluss f&auml;llig, die restlichen 12 Raten immer zum Ersten des Monats ab dem Monat des Unterrichtsbeginns.</p>
<p style="margin:0 0 10px;font-size:14px;line-height:1.7;">Das Examen ist eine der wichtigsten Weichenstellungen der juristischen Ausbildung. Schon wenige Punkte Unterschied k&ouml;nnen sich erheblich auf sp&auml;tere Karrierechancen, berufliche Entwicklung und Einkommensm&ouml;glichkeiten auswirken. Vor diesem Hintergrund verstehen viele unserer Kandidatinnen und Kandidaten (ca. 450&ndash;500 TN/Jahr im Einzelunterricht) die gezielte Vorbereitung nicht als blo&szlig;en Kostenpunkt, sondern als bewusstes Investment in eine Zukunft, deren Mehrwert den urspr&uuml;nglichen Aufwand h&auml;ufig um ein Vielfaches &uuml;bersteigt.</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.7;">Nicht wenige unserer ehemaligen Absolventen arbeiten heute (u.a.) in Top-Wirtschaftskanzleien mit herausragender Verg&uuml;tung. Nur exemplarisch vier Profile ehemaliger Teilnehmer (alle mit DOPPEL-PR&Auml;DIKAT):</p>
<ul style="margin:0 0 4px;padding-left:20px;font-size:14px;line-height:1.8;">
<li><a href="https://www.osborneclarke.com/de/lawyers/julian-s-tristram" style="color:#2D84C1;">Julian S. Tristram (Osborne Clarke)</a></li>
<li><a href="https://neon.law/people/thomas-haertinger" style="color:#2D84C1;">Thomas H&auml;rtinger (neon.law)</a></li>
<li><a href="https://cms.law/de/deu/personen/viola-raue" style="color:#2D84C1;">Viola Raue (CMS)</a></li>
<li><a href="https://www.quinnemanuel.com/attorneys/bergann-franz/" style="color:#2D84C1;">Bergann Franz (Quinn Emanuel)</a></li>
</ul>
</td></tr><!--/SECTION:preisuebersicht-->

<!--SECTION:motivation--><tr><td style="padding:24px 32px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-left:5px solid #2D84C1;border-radius:10px;">
<tr><td style="padding:20px 22px;font-size:15px;line-height:1.7;">
<p style="margin:0 0 10px;font-weight:700;color:#000000;font-size:17px;">Motivationsschub f&uuml;r Ihre Examensvorbereitung</p>
<p style="margin:0 0 10px;">Wir setzen den Fokus auf das Verst&auml;ndnis der wesentlichen Punkte, statt auf blo&szlig;es Auswendiglernen. Ziel ist es, Ihnen das n&ouml;tige &bdquo;Handwerkszeug&ldquo; zu vermitteln, damit Sie sicher und erfolgreich in die Pr&uuml;fung gehen k&ouml;nnen.</p>
<p style="margin:0 0 10px;">Wir begleiten Sie mit Motivation, Einsatzbereitschaft und Erfolgserlebnissen durch die Examensvorbereitung, sodass diese intensive Zeit nicht als Last, sondern als produktive und bereichernde Phase Ihres Wissensaufbaus empfunden wird.</p>
<p style="margin:0 0 6px;">&#9654; Rezensionen: Lesen Sie <a href="https://www.google.com/search?q=Akademie+Kraatz" style="color:#2D84C1;font-weight:600;">Kundenmeinungen</a> oder sehen Sie sich die Erfolgsgeschichten unten an.</p>
<div style="margin:0 0 12px;"><a href="https://www.loom.com/share/662c8487720e4bf3abc1f0dfdd5678fe" style="display:block;max-width:320px;text-decoration:none;"><img src="https://cdn.loom.com/sessions/thumbnails/662c8487720e4bf3abc1f0dfdd5678fe-fd07b46f073af0c2.gif" width="320" alt="Pers&ouml;nliches Video von unserem Gr&uuml;nder RA Mario Kraatz" style="display:block;width:100%;max-width:320px;height:auto;border-radius:10px;border:1px solid #E9ECEF;"></a><p style="margin:6px 0 0;font-size:13px;line-height:1.5;"><a href="https://www.loom.com/share/662c8487720e4bf3abc1f0dfdd5678fe" style="color:#2D84C1;font-weight:600;text-decoration:none;">&#9654; Pers&ouml;nliches Video von unserem Gr&uuml;nder RA Mario Kraatz</a></p></div>
</td></tr>
</table>
</td></tr><!--/SECTION:motivation-->

<!--SECTION:testimonials--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Das sagen unsere Teilnehmer</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.6;">
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Lisa Budich</strong><br><em>&bdquo;Ich bin überglücklich &ndash; ich habe das 1. Juristische Staatsexamen geschafft. Dieses unglaublich schöne Erfolgserlebnis habe ich auch der Akademie Kraatz zu verdanken.&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Alessandra Novelli</strong><br><em>&bdquo;Ich habe insgesamt im Staatsteil 8,81 Punkte. Damit habe ich eine Gesamtnote von 10,26 Punkten. Ich kann nur sagen, dass der Unterricht damit erfolgreich war!&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Franziska J.</strong><br><em>&bdquo;Nun ist es geschafft mit 9,57 Punkten im Zweiten Examen. Vielen Dank für die super Vorbereitung &ndash; die Dozenten waren fachlich wie menschlich wahnsinnig kompetent.&ldquo;</em></td></tr></table></td></tr>
<tr><td style="padding:0 0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-radius:10px;"><tr><td style="padding:14px 16px;"><span style="color:#F5B301;">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong style="color:#000000;">Adrian Amann</strong><br><em>&bdquo;Die Dozenten sind wirklich erstklassig, super flexibel, antworten teils innerhalb weniger Minuten. Fachlich sowieso einwandfrei.&ldquo;</em></td></tr></table></td></tr>
</table>
<p style="margin:10px 0 0;font-size:13px;"><a href="https://kraatz-group.de/erfahrungsberichte" style="color:#2D84C1;font-weight:600;">Weitere Erfahrungsberichte ansehen &rarr;</a></p>
</td></tr><!--/SECTION:testimonials-->

<!--SECTION:naechste-schritte--><tr><td style="padding:24px 32px 32px;font-size:16px;line-height:1.7;color:#4E5D78;">
<h2 style="margin:0 0 12px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">N&auml;chste Schritte</h2>
<p style="margin:0 0 14px;">Wie gesagt: Es f&uuml;llt sich alles schnell aktuell. Wir fahren hier nach dem Muster: &bdquo;Wer zuerst kommt, malt zuerst&ldquo; &#128522;</p>
<p style="margin:0 0 14px;">Sie erhalten gleich noch eine separate Mail mit den <strong style="color:#000000;">Probeunterrichtseinheiten</strong> der Dozenten im StR, &Ouml;R und ZR.</p>
<p style="margin:0 0 14px;">F&uuml;r R&uuml;ckfragen stehe ich Ihnen jederzeit zur Verf&uuml;gung. Gemeinsam schaffen wir das &ndash; mit Motivation, Einsatz und Erfolg! &#128522;</p>
<p style="margin:0;">Ich w&uuml;nsche Ihnen einen angenehmen Tag.<br><br>Mit freundlichen Gr&uuml;&szlig;en,<br><strong style="color:#000000;">RA Mario Kraatz</strong></p>
</td></tr><!--/SECTION:naechste-schritte-->

<tr><td align="center" style="padding:20px 24px;background-color:#F8F9FA;border-top:1px solid #E9ECEF;font-size:12px;line-height:1.7;color:#666666;">
Akademie Kraatz GmbH &middot; Wilmersdorfer Str. 145/146 &middot; 10585 Berlin<br>
<a href="https://www.instagram.com/kraatzgroup" style="color:#2D84C1;text-decoration:none;">Instagram</a> &middot;
<a href="https://www.youtube.com/@kraatzgroup" style="color:#2D84C1;text-decoration:none;">YouTube</a> &middot;
<a href="https://www.tiktok.com/@kraatzgroup" style="color:#2D84C1;text-decoration:none;">TikTok</a><br>
<a href="https://kraatz-group.de/impressum/" style="color:#666666;">Impressum</a> &middot;
<a href="https://kraatz-group.de/datenschutzerklaerung/" style="color:#666666;">Datenschutz</a>
</td></tr>

</table>
</div>$tpl$, updated_at = now() WHERE id='angebot-elite';
