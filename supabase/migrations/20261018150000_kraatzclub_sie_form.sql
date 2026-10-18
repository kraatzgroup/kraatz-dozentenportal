-- Kraatz-Club-Info und Angebot-Betreff: Sie-Form.
UPDATE public.email_templates SET body = replace(body, $a$Hallo [Vorname],$a$, $b$[Anrede_Gruss],$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$für Dein Interesse$a$, $b$für Ihr Interesse$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$zu deiner Situation passt, möchten wir Dich auf$a$, $b$zu Ihrer Situation passt, möchten wir Sie auf$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$Das erwartet Dich im$a$, $b$Das erwartet Sie im$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$>Deine Vorteile<$a$, $b$>Ihre Vorteile<$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$optimal auf Deine Prüfungen$a$, $b$optimal auf Ihre Prüfungen$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$empfehlen wir Dir die$a$, $b$empfehlen wir Ihnen die$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$für Deine Zwischenprüfung$a$, $b$für Ihre Zwischenprüfung$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$Bist Du bereit?$a$, $b$Sind Sie bereit?$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$startest Du richtig durch$a$, $b$starten Sie richtig durch$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$melde Dich jederzeit$a$, $b$melden Sie sich jederzeit$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$wenn wir Dich im Kraatz Club$a$, $b$wenn wir Sie im Kraatz Club$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET body = replace(body, $a$Dein Team der Akademie Kraatz$a$, $b$Ihr Team der Akademie Kraatz$b$), updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET subject = 'Der Kraatz Club – Ihre digitale Jura-Lernplattform', updated_at = now() WHERE id='kraatzclub-info';
UPDATE public.email_templates SET subject = 'Ihr Einzelunterricht bei der Akademie Kraatz', updated_at = now() WHERE id='angebot';
