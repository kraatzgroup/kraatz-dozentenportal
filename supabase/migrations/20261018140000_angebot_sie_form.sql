-- Einzelunterricht-Angebot: Sie-Form und geschlechtsabhängige Anrede.
UPDATE public.email_templates SET body = replace(body, $a$Hallo [Vorname],$a$, $b$[Anrede_Gruss],$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$vielen Dank für Deine Anfrage und unser angenehmes Gespräch vorhin. Gerne gebe ich Dir vorab einige Details zu Deinem effektiven$a$, $b$vielen Dank für Ihre Anfrage und unser angenehmes Gespräch vorhin. Gerne gebe ich Ihnen vorab einige Details zu Ihrem effektiven$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Dein persönliches Angebot$a$, $b$Ihr persönliches Angebot$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Dein Einzelunterricht im Überblick$a$, $b$Ihr Einzelunterricht im Überblick$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$auf Dich &ndash; keine Massenveranstaltung, Du stehst im Mittelpunkt$a$, $b$auf Sie &ndash; keine Massenveranstaltung, Sie stehen im Mittelpunkt$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$nach Deinen Wünschen$a$, $b$nach Ihren Wünschen$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Verschaffe Dir einen ersten Eindruck$a$, $b$Verschaffen Sie sich einen ersten Eindruck$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Als Kursteilnehmer erhältst Du außerdem$a$, $b$Als [Kursteilnehmer] erhalten Sie außerdem$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Motivationsschub für Deine Examensvorbereitung$a$, $b$Motivationsschub für Ihre Examensvorbereitung$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Dir das nötige$a$, $b$Ihnen das nötige$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$damit Du sicher und erfolgreich in die Prüfung gehst$a$, $b$damit Sie sicher und erfolgreich in die Prüfung gehen$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Wir begleiten Dich mit$a$, $b$Wir begleiten Sie mit$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$über Dein Paket$a$, $b$über Ihr Paket$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$stehe ich Dir jederzeit$a$, $b$stehe ich Ihnen jederzeit$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$gestalten wir Deine Examensvorbereitung$a$, $b$gestalten wir Ihre Examensvorbereitung$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Ich wünsche Dir einen$a$, $b$Ich wünsche Ihnen einen$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET body = replace(body, $a$Dein Team der Akademie Kraatz$a$, $b$Ihr Team der Akademie Kraatz$b$), updated_at = now() WHERE id='angebot';
UPDATE public.email_templates SET subject = replace(subject, 'Dein Einzelunterricht', 'Ihr Einzelunterricht'), updated_at = now() WHERE id='angebot';
