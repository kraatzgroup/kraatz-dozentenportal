// Edge-Function: Dozent per E-Mail über den Abschluss einer Nachbuchung informieren.
// Wird aufgerufen, sobald die Verwaltung den Vermerk setzt (zustande Ja/Nein).
console.log('🚀 nachbuchung-abschluss edge function loaded');

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const MAILGUN_DOMAIN = 'kraatz-group.de';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase environment incomplete' }, 500);

  const authHeader = req.headers.get('Authorization');
  const callerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!callerToken) return json({ error: 'Unauthorized' }, 401);

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authError } = await authClient.auth.getUser(callerToken);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, additional_roles')
    .eq('id', user.id)
    .maybeSingle();

  const roles = new Set([callerProfile?.role, ...(callerProfile?.additional_roles || [])]);
  const isStaff = roles.has('admin') || roles.has('verwaltung') || roles.has('vertrieb');
  if (!isStaff) return json({ error: 'Forbidden' }, 403);

  try {
    const body = await req.json();
    const id = body?.id as string | undefined;
    if (!id) return json({ error: 'id ist erforderlich' }, 400);

    const { data: row } = await supabase
      .from('nachbuchungen')
      .select('id, teilnehmer_name, teilnehmer_tn_nummer, dozent_id, rechtsgebiet, nachbuchung_zustande, nachbuchung_stunden, nachbuchung_provision')
      .eq('id', id)
      .maybeSingle();

    if (!row) return json({ error: 'Anfrage nicht gefunden' }, 404);
    if (row.nachbuchung_zustande === null) {
      return json({ ok: true, skipped: 'offen' });
    }

    const { data: dozent } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', row.dozent_id)
      .maybeSingle();

    if (!dozent || !dozent.email) return json({ error: 'Dozent nicht gefunden oder ohne E-Mail' }, 404);

    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    if (!mailgunApiKey) return json({ ok: true, skipped: 'no-mailgun' });

    const teilnehmerLabel = [row.teilnehmer_name, row.teilnehmer_tn_nummer].filter(Boolean).join(' · ');
    const zustande = row.nachbuchung_zustande === true;

    const subject = zustande
      ? `Nachbuchung zustande gekommen – ${teilnehmerLabel}`
      : `Nachbuchung nicht zustande gekommen – ${teilnehmerLabel}`;

    const bodyText = zustande
      ? `
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          Gute Nachrichten: Für <strong>${teilnehmerLabel}</strong> im Fachgebiet
          <strong>${row.rechtsgebiet}</strong> ist eine Nachbuchung von
          <strong>${row.nachbuchung_stunden ?? '–'} Stunden</strong> zustande gekommen.
        </p>
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          Sie können eine Pauschale in Form einer Provision in Höhe von
          <strong>${row.nachbuchung_provision ?? '–'} €</strong> mit der nächsten Rechnung einreichen.
        </p>
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          Vielen Dank für Ihre Kooperation.
        </p>`
      : `
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          Für <strong>${teilnehmerLabel}</strong> im Fachgebiet
          <strong>${row.rechtsgebiet}</strong> ist leider keine Nachbuchung zustande gekommen.
        </p>
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          Vielen Dank für Ihre Kooperation.
        </p>`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
        </div>
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">${zustande ? 'Nachbuchung zustande gekommen' : 'Nachbuchung nicht zustande gekommen'}</h2>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Guten Tag ${dozent.full_name || 'sehr geehrter Dozent, sehr geehrte Dozentin'},
          </p>
          ${bodyText}
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
        </div>
      </div>`;

    const formData = new FormData();
    formData.append('from', 'Kraatz Group Portal <postmaster@kraatz-group.de>');
    formData.append('to', dozent.email);
    formData.append('subject', subject);
    formData.append('html', emailHtml);
    formData.append('charset', 'utf-8');

    try {
      const mailgunResponse = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
        method: 'POST',
        headers: { Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}` },
        body: formData,
      });
      if (!mailgunResponse.ok) {
        console.error('❌ Mailgun error:', await mailgunResponse.text());
        return json({ ok: false, error: 'Mailgun error' }, 502);
      }
    } catch (mailgunError) {
      console.error('❌ Failed to send email:', mailgunError);
      return json({ ok: false, error: 'Failed to send email' }, 502);
    }

    return json({ ok: true, sent: true, zustande });
  } catch (error) {
    console.error('❌ Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});