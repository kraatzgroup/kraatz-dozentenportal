-- Produktstruktur: PLATIN (140 Std.) und GOLD (70 Std.), Stundenverteilung/Laufzeit/Preise dynamisch per Platzhalter.
UPDATE public.email_templates
SET body = regexp_replace(
  regexp_replace(body,
    '<strong style="color:#000000;">12 Monate Unterricht.*?beliebige Monatsdauer verteilt werden\.</span>',
    $r$<strong style="color:#000000;">[Stundenpaket]<!--IF:paket--> &middot; [Laufzeit] &middot; [Stundenanzahl] Stunden<!--/IF:paket--></strong><br>
Zivilrecht (ZR): [Stunden_ZR] Stunden (Stoff wird u.a. anhand von [Klausuren_ZR] Examensklausuren besprochen)<br>
Öffentliches Recht (ÖR): [Stunden_OER] Stunden (Stoff wird u.a. anhand von [Klausuren_OER] Examensklausuren besprochen)<br>
Strafrecht (StR): [Stunden_STR] Stunden (Stoff wird u.a. anhand von [Klausuren_STR] Examensklausuren besprochen)<br>
<span style="font-size:13px;">Flexible Stundenaufteilung &ndash; die Stunden können individuell auf die Rechtsgebiete verteilt werden.</span>$r$,
    's'),
  '<!--SECTION:preisuebersicht-->.*<!--/SECTION:preisuebersicht-->',
  $r$<!--SECTION:preisuebersicht--><tr><td style="padding:24px 32px 4px;">
<h2 style="margin:0 0 14px;padding-left:12px;border-left:4px solid #2D84C1;font-size:20px;color:#000000;">Preisübersicht</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.5;border-collapse:separate;border-spacing:0 8px;">
<tr><td style="background-color:#CFD6DE;background-image:linear-gradient(135deg,#F8FAFC 0%,#CFD6DE 25%,#FFFFFF 45%,#AEB7C2 70%,#E9EDF1 100%);color:#334155;padding:14px 16px;border-radius:10px 0 0 10px;[Platin_Rahmen_L]"><strong>Einzelunterricht 1. Staatsexamen | PLATIN</strong> [Platin_Tag]<br><span style="font-size:12px;">140 Unterrichtsstunden &middot; alle Rechtsgebiete &middot; [Laufzeit] &agrave; [Platin_Rate] &middot; [Platin_Stundenpreis]/h</span></td><td align="right" style="background-color:#CFD6DE;background-image:linear-gradient(135deg,#F8FAFC 0%,#CFD6DE 25%,#FFFFFF 45%,#AEB7C2 70%,#E9EDF1 100%);color:#334155;padding:14px 16px;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;white-space:nowrap;[Platin_Rahmen_R]">[Platin_Preis]</td></tr>
<tr><td style="background-color:#E8C14F;background-image:linear-gradient(135deg,#FFF6C9 0%,#E8C14F 25%,#FFF3B0 45%,#C9972B 70%,#F3D878 100%);color:#5A3D00;padding:14px 16px;border-radius:10px 0 0 10px;[Gold_Rahmen_L]"><strong>Einzelunterricht 1. Staatsexamen | GOLD</strong> [Gold_Tag]<br><span style="font-size:12px;">70 Unterrichtsstunden &middot; alle Rechtsgebiete &middot; [Laufzeit] &agrave; [Gold_Rate] &middot; [Gold_Stundenpreis]/h</span></td><td align="right" style="background-color:#E8C14F;background-image:linear-gradient(135deg,#FFF6C9 0%,#E8C14F 25%,#FFF3B0 45%,#C9972B 70%,#F3D878 100%);color:#5A3D00;padding:14px 16px;border-radius:0 10px 10px 0;font-size:18px;font-weight:700;white-space:nowrap;[Gold_Rahmen_R]">[Gold_Preis]</td></tr>
[Individuell_Zeile]
</table>
<p style="margin:12px 0 0;font-size:13px;line-height:1.6;">Die Stunden verteilen sich standardmäßig auf Zivilrecht, Öffentliches Recht und Strafrecht &ndash; die Verteilung sowie der Gesamtumfang können individuell angepasst werden.</p>
</td></tr><!--/SECTION:preisuebersicht-->$r$,
  's'),
  updated_at = now()
WHERE body LIKE '%<!--SECTION:preisuebersicht-->%';

-- Angebotskarte oben in der Mail: Platin-/Gold-Material, Laufzeit und Monatsrate ergänzt.
UPDATE public.email_templates
SET body = regexp_replace(body,
  '<!--IF:angebot-->.*?<!--/IF:angebot-->',
  $r$<!--IF:angebot-->
<tr><td style="padding:8px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="[Karte_Stil]border-radius:12px;"><tr><td style="padding:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid [Karte_Rahmen];border-radius:8px;">
<tr><td style="padding:12px;[Karte_Muster]"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid [Karte_Rahmen];border-radius:6px;[Karte_Stil]"><tr><td style="padding:16px 18px;color:[Karte_Text];">
<p style="margin:0 0 12px;text-align:center;"><span style="display:inline-block;background-color:[Karte_Rahmen];color:[Karte_Tag_Text];font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:12px;">Dein persönliches Angebot</span></p>
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
<!--/IF:angebot-->$r$,
  's'),
  updated_at = now()
WHERE body LIKE '%<!--IF:angebot-->%';
