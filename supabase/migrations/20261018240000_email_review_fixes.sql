-- Review aller Mail-Bodies: Sie-Form (IHR PAKET), dynamische Laufzeit, Footer-Links, Tippfehler.
UPDATE public.email_templates SET body = replace(body, 'DEIN PAKET', 'IHR PAKET'), updated_at = now() WHERE id IN ('angebot','angebot-elite');
UPDATE public.email_templates SET body = replace(body,
  'des Repetitors auf Sie mit 12 Monaten Einzelunterricht (genauere',
  'des Repetitors auf Sie<!--IF:paket--> &ndash; Einzelunterricht über [Laufzeit]<!--/IF:paket--> (genauere'), updated_at = now() WHERE id = 'angebot';
UPDATE public.email_templates SET body = regexp_replace(body,
  '<a href="https://www\.instagram\.com/kraatzgroup".*?TikTok</a><br>',
  $f$<span style="color:#666666;">&Uuml;brigens, Sie finden uns auch auf</span><br>
<a href="https://www.youtube.com/channel/UCelspPjl7qVPqa5Ga7povTQ" style="color:#2D84C1;text-decoration:none;">YouTube</a> &middot;
<a href="https://de-de.facebook.com/meinjurarepetitorium/" style="color:#2D84C1;text-decoration:none;">Facebook</a> &middot;
<a href="https://www.instagram.com/akademiekraatz/" style="color:#2D84C1;text-decoration:none;">Instagram</a> &middot;
<a href="https://www.tiktok.com/@kraatzgroup" style="color:#2D84C1;text-decoration:none;">TikTok</a><br>$f$, 's'), updated_at = now() WHERE id = 'angebot-elite';
UPDATE public.email_templates SET body = replace(body, 'entwickeln von den erfahrenen', 'entwickelt von den erfahrenen'), updated_at = now() WHERE id = 'kraatzclub-info';
