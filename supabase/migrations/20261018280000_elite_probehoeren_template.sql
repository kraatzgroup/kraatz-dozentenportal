-- Neues E-Mail-Template: ELITE Kleingruppe Probehören (Layout wie die übrigen Angebots-Mails).
INSERT INTO public.email_templates (id, title, icon, description, subject, body, is_html, category)
VALUES ('elite-probehoeren', 'ELITE Kleingruppe Probehören', '🎧', 'Ergänzungsmail mit Links zu Infos, Probestunden und Demo-Video',
  'Ergänzung zum Angebot – ELITE Kleingruppe Probehören',
  $tpl$<div style="margin:0;padding:24px 12px;background-color:#F3F4FA;font-family:'Montserrat','Avenir','Avenir Next',Arial,sans-serif;color:#4E5D78;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">


<tr><td style="padding:36px 32px 8px;font-size:16px;line-height:1.7;color:#4E5D78;">
<p style="margin:0 0 16px;">[Anrede_Gruss],</p>
<p style="margin:0 0 16px;">unter diesem Link finden Sie auch noch einmal alle Infos zur ELITE Kleingruppe auf unserer Website mit Interviews der Dozenten:</p>
</td></tr>

<!--SECTION:probehoeren--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">ELITE Kleingruppe Probehören</h2>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 0 8px 0;"><a href="https://kraatz-group.de/elite-kleingruppen/" style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">ELITE Kleingruppe &ndash; Infos &amp; Dozenten-Interviews</a></td>
</tr><tr>
<td style="padding:0 0 8px 0;"><a href="https://elite-kleingruppe.kraatz-group.de/elite-kleingruppe-probehoren" style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Probestunden der 3 Fachdozenten ansehen</a></td>
</tr><tr>
<td style="padding:0 0 8px 0;"><a href="https://youtu.be/quq1hPdD9us" style="display:inline-block;background-color:#2D84C1;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">So arbeiten wir digital</a></td>
</tr></table>
<p style="margin:8px 0 0;font-size:15px;line-height:1.7;">Dies als Erg&auml;nzung zum Angebot eben. Viel Freude damit.</p>
</td></tr><!--/SECTION:probehoeren-->

<tr><td style="padding:24px 32px 4px;font-size:16px;line-height:1.7;color:#4E5D78;">
<p style="margin:0;">Beste Gr&uuml;&szlig;e,<br><strong style="color:#000000;">Mario Kraatz</strong></p>
</td></tr>

<!--SECTION:smartskript--><tr><td style="padding:24px 32px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4FA;border-left:5px solid #2D84C1;border-radius:10px;">
<tr><td style="padding:20px 22px;font-size:15px;line-height:1.7;">
<p style="margin:0 0 10px;">Wir freuen uns, dass wir endlich das erste <strong style="color:#000000;">Smart-Skript der Kraatz Group</strong> pr&auml;sentieren k&ouml;nnen. Entdecken Sie jetzt unter <a href="https://kraatz-group.de/jura-essentials/" style="color:#2D84C1;font-weight:600;">kraatz-group.de/jura-essentials</a>, wie Sie effektiv kombiniert mit Skript und Lernvideos Jura lernen k&ouml;nnen!</p>
<p style="margin:0 0 6px;"><strong style="color:#000000;">Rechtsanwalt Mario Kraatz</strong></p>
<p style="margin:0 0 2px;">Telefon: <a href="tel:+493075657397" style="color:#2D84C1;">+49 30 75657397</a></p>
<p style="margin:0 0 2px;">E-Mail: <a href="mailto:mariokraatz@kraatz-group.de" style="color:#2D84C1;">mariokraatz@kraatz-group.de</a></p>
<p style="margin:0;">Website: <a href="https://kraatz-group.de/" style="color:#2D84C1;">kraatz-group.de</a></p>
</td></tr>
</table>
</td></tr><!--/SECTION:smartskript-->

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
</div>$tpl$, true, 'angebot')
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, icon=EXCLUDED.icon, description=EXCLUDED.description,
  subject=EXCLUDED.subject, body=EXCLUDED.body, is_html=EXCLUDED.is_html, category=EXCLUDED.category, updated_at=now();
