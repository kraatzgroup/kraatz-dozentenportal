-- Online-Unterricht-Video: web-optimierte Version (Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht_web.mp4).
UPDATE public.email_templates
SET body = replace(body,
      'Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht.mp4',
      'Videos-Portal/akademie-kraatz/Einzel_Onlineunterricht_web.mp4'),
  updated_at = now()
WHERE id IN ('angebot', 'angebot-elite');
